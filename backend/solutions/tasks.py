import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def analyze_service_request(self, service_request_id: str):
    """Run AI analysis on a service request and store results."""
    from .models import ServiceRequest
    from .services import analyze_request

    try:
        sr = ServiceRequest.objects.get(id=service_request_id)
    except ServiceRequest.DoesNotExist:
        logger.error(f"ServiceRequest {service_request_id} not found")
        return

    if sr.ai_summary and sr.ai_suggested_solution:
        logger.info(f"ServiceRequest {service_request_id} already has AI analysis")
        return

    try:
        summary, suggested = analyze_request(
            requirements=sr.requirements,
            business_type=sr.business_type,
            tools_used=sr.tools_used,
            service_type=sr.service_type,
            budget=sr.get_budget_display(),
        )

        update_fields = []
        if summary:
            sr.ai_summary = summary
            update_fields.append('ai_summary')
        if suggested:
            sr.ai_suggested_solution = suggested
            update_fields.append('ai_suggested_solution')

        if update_fields:
            sr.save(update_fields=update_fields)
            logger.info(f"AI analysis complete for ServiceRequest {service_request_id}")
        else:
            logger.warning(f"AI analysis returned no results for {service_request_id}")

    except Exception as e:
        logger.error(f"AI analysis failed for {service_request_id}: {e}", exc_info=True)
        error_str = str(e).lower()
        if 'api key' in error_str or 'not configured' in error_str:
            logger.warning(f"Non-transient AI error for {service_request_id}, skipping retry")
            return
        self.retry(exc=e)
