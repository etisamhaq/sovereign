"""Tests for the Solutions module."""
import pytest
from django.urls import reverse
from rest_framework import status
from solutions.models import ServiceRequest, BookCallRequest


@pytest.fixture
def service_request_data():
    return {
        'service_type': 'automation',
        'package_tier': 'growth',
        'name': 'Jane Doe',
        'email': 'jane@example.com',
        'business_type': 'SaaS / Software',
        'requirements': 'We need to automate our entire onboarding pipeline including email sequences and CRM updates.',
        'tools_used': 'Zapier, HubSpot, Gmail',
        'budget': '1000_2500',
        'timeline': 'standard',
    }


@pytest.mark.django_db
class TestCreateServiceRequest:
    def test_guest_can_create_request(self, api_client, service_request_data):
        url = '/api/solutions/request/'
        resp = api_client.post(url, service_request_data, format='json')
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data['service_type'] == 'automation'
        assert resp.data['package_tier'] == 'growth'
        assert ServiceRequest.objects.count() == 1
        sr = ServiceRequest.objects.first()
        assert sr.user is None
        assert sr.email == 'jane@example.com'

    def test_authenticated_user_attached(self, auth_client, user, service_request_data):
        url = '/api/solutions/request/'
        resp = auth_client.post(url, service_request_data, format='json')
        assert resp.status_code == status.HTTP_201_CREATED
        sr = ServiceRequest.objects.first()
        assert sr.user == user

    def test_short_requirements_rejected(self, api_client, service_request_data):
        service_request_data['requirements'] = 'too short'
        url = '/api/solutions/request/'
        resp = api_client.post(url, service_request_data, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_invalid_service_type_rejected(self, api_client, service_request_data):
        service_request_data['service_type'] = 'invalid'
        url = '/api/solutions/request/'
        resp = api_client.post(url, service_request_data, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestMyServiceRequests:
    def test_unauthenticated_blocked(self, api_client):
        resp = api_client.get('/api/solutions/my-requests/')
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_own_requests(self, auth_client, user, service_request_data):
        ServiceRequest.objects.create(user=user, amount=799, **service_request_data)
        resp = auth_client.get('/api/solutions/my-requests/')
        assert resp.status_code == status.HTTP_200_OK
        results = resp.data if isinstance(resp.data, list) else resp.data.get('results', resp.data)
        assert len(results) >= 1

    def test_cannot_see_other_users_requests(self, auth_client, second_user, service_request_data):
        ServiceRequest.objects.create(user=second_user, amount=799, **service_request_data)
        resp = auth_client.get('/api/solutions/my-requests/')
        assert resp.status_code == status.HTTP_200_OK
        results = resp.data if isinstance(resp.data, list) else resp.data.get('results', resp.data)
        assert len(results) == 0


@pytest.mark.django_db
class TestAdminServiceRequests:
    def test_non_admin_blocked(self, auth_client, service_request_data):
        ServiceRequest.objects.create(amount=799, **service_request_data)
        resp = auth_client.get('/api/solutions/admin/requests/')
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_admin_can_list(self, admin_auth_client, service_request_data):
        ServiceRequest.objects.create(amount=799, **service_request_data)
        resp = admin_auth_client.get('/api/solutions/admin/requests/')
        assert resp.status_code == status.HTTP_200_OK

    def test_admin_can_update_status(self, admin_auth_client, service_request_data):
        sr = ServiceRequest.objects.create(amount=799, **service_request_data)
        resp = admin_auth_client.patch(
            f'/api/solutions/admin/requests/{sr.id}/',
            {'status': 'in_progress'},
            format='json',
        )
        assert resp.status_code == status.HTTP_200_OK
        sr.refresh_from_db()
        assert sr.status == 'in_progress'

    def test_admin_can_filter_by_status(self, admin_auth_client, service_request_data):
        ServiceRequest.objects.create(amount=799, status='pending', **service_request_data)
        ServiceRequest.objects.create(amount=299, status='completed', **{**service_request_data, 'package_tier': 'starter'})
        resp = admin_auth_client.get('/api/solutions/admin/requests/?status=pending')
        assert resp.status_code == status.HTTP_200_OK
        results = resp.data if isinstance(resp.data, list) else resp.data.get('results', resp.data)
        assert all(r['status'] == 'pending' for r in results)


@pytest.mark.django_db
class TestBookCall:
    def test_guest_can_book_call(self, api_client):
        resp = api_client.post('/api/solutions/book-call/', {
            'name': 'Test',
            'email': 'test@example.com',
            'service_type': 'agents',
            'message': 'I want to discuss custom agents',
        }, format='json')
        assert resp.status_code == status.HTTP_201_CREATED
        assert BookCallRequest.objects.count() == 1


@pytest.mark.django_db
class TestPricingEndpoint:
    def test_pricing_returns_all_types(self, api_client):
        resp = api_client.get('/api/solutions/pricing/')
        assert resp.status_code == status.HTTP_200_OK
        assert 'automation' in resp.data
        assert 'agents' in resp.data
        assert 'optimization' in resp.data
        assert resp.data['automation']['starter'] == 299
