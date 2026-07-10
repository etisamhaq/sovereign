"""
Load testing script using Locust
Tests the application's ability to handle 1000+ concurrent users
"""
from locust import HttpUser, task, between, events
import random
import json
import time
from datetime import datetime

# Sample data for testing
SAMPLE_TEXTS = [
    "The quick brown fox jumps over the lazy dog. This is a sample text for testing.",
    "Artificial intelligence is transforming the way we work and live.",
    "Load testing helps ensure applications can handle expected traffic.",
    "Python is a versatile programming language used for web development, data science, and more.",
    "Cloud computing provides scalable infrastructure for modern applications.",
]

SAMPLE_TOPICS = [
    "The impact of AI on education",
    "Climate change and renewable energy",
    "Remote work and its future",
    "Cryptocurrency and digital finance",
    "Space exploration in the 21st century",
]

TOOLS = [
    "ai-paraphrasing",
    "grammar-checker",
    "essay-generator",
    "text-summarizer",
    "tone-analyzer",
    "title-generator",
    "meta-description",
]


class AIToolUser(HttpUser):
    """Simulates a user interacting with AI tools"""
    
    wait_time = between(1, 5)  # Wait 1-5 seconds between tasks
    
    def on_start(self):
        """Called when a user starts"""
        # Login or get auth token
        self.auth_token = None
        self.user_id = random.randint(1, 10000)
        
        # Try to login (optional, can test both authenticated and anonymous)
        if random.random() < 0.7:  # 70% of users are authenticated
            self.login()
    
    def login(self):
        """Simulate user login"""
        response = self.client.post("/api/auth/login/", json={
            "email": f"user{self.user_id}@test.com",
            "password": "testpassword123"
        }, catch_response=True)
        
        if response.status_code == 200:
            data = response.json()
            self.auth_token = data.get('access')
            response.success()
        else:
            # Create account if login fails
            self.register()
    
    def register(self):
        """Simulate user registration"""
        response = self.client.post("/api/auth/register/", json={
            "email": f"user{self.user_id}@test.com",
            "password": "testpassword123",
            "first_name": f"Test{self.user_id}",
            "last_name": "User"
        }, catch_response=True)
        
        if response.status_code in [200, 201]:
            self.login()
            response.success()
        else:
            response.failure(f"Registration failed: {response.text}")
    
    @task(10)
    def use_paraphrasing_tool(self):
        """Test paraphrasing tool - most common"""
        headers = self._get_headers()
        text = random.choice(SAMPLE_TEXTS)
        mode = random.choice(['standard', 'formal', 'casual', 'creative', 'simple'])
        
        response = self.client.post(
            "/api/tools/ai-paraphrasing/use/",
            json={
                "text": text,
                "mode": mode
            },
            headers=headers,
            catch_response=True
        )
        
        self._handle_response(response, "paraphrasing")
    
    @task(8)
    def use_grammar_checker(self):
        """Test grammar checker"""
        headers = self._get_headers()
        text = random.choice(SAMPLE_TEXTS)
        
        response = self.client.post(
            "/api/tools/grammar-checker/use/",
            json={"text": text},
            headers=headers,
            catch_response=True
        )
        
        self._handle_response(response, "grammar_checker")
    
    @task(5)
    def use_essay_generator(self):
        """Test essay generator - resource intensive"""
        headers = self._get_headers()
        topic = random.choice(SAMPLE_TOPICS)
        
        response = self.client.post(
            "/api/tools/essay-generator/use/",
            json={
                "topic": topic,
                "essay_type": random.choice(['argumentative', 'descriptive', 'narrative']),
                "length": random.choice([300, 500, 800])
            },
            headers=headers,
            catch_response=True
        )
        
        self._handle_response(response, "essay_generator")
    
    @task(6)
    def use_summarizer(self):
        """Test text summarizer"""
        headers = self._get_headers()
        # Use longer text for summarization
        text = " ".join(random.sample(SAMPLE_TEXTS, 3))
        
        response = self.client.post(
            "/api/tools/text-summarizer/use/",
            json={
                "text": text,
                "length": random.choice(['short', 'medium', 'long'])
            },
            headers=headers,
            catch_response=True
        )
        
        self._handle_response(response, "summarizer")
    
    @task(3)
    def browse_tools(self):
        """Browse available tools"""
        response = self.client.get(
            "/api/tools/",
            catch_response=True
        )
        
        if response.status_code == 200:
            response.success()
        else:
            response.failure(f"Failed to browse tools: {response.status_code}")
    
    @task(2)
    def check_health(self):
        """Check application health"""
        response = self.client.get(
            "/health/",
            catch_response=True
        )
        
        if response.status_code == 200:
            response.success()
        else:
            response.failure(f"Health check failed: {response.status_code}")
    
    def _get_headers(self):
        """Get request headers with auth token if available"""
        headers = {"Content-Type": "application/json"}
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        return headers
    
    def _handle_response(self, response, tool_name):
        """Handle and validate API response"""
        if response.status_code == 200:
            try:
                data = response.json()
                # Validate response has expected structure
                if 'result' in data or 'data' in data or 'paraphrased_text' in data:
                    response.success()
                else:
                    response.failure(f"{tool_name}: Invalid response structure")
            except json.JSONDecodeError:
                response.failure(f"{tool_name}: Invalid JSON response")
        elif response.status_code == 429:
            # Rate limited - this is expected under load
            response.success()  # Don't count as failure
        elif response.status_code == 503:
            response.failure(f"{tool_name}: Service unavailable")
        else:
            response.failure(f"{tool_name}: Status {response.status_code}")


class AdminUser(HttpUser):
    """Simulates admin/monitoring activities"""
    
    wait_time = between(10, 30)  # Less frequent
    weight = 1  # Only 1 admin for every 10 regular users
    
    @task
    def check_metrics(self):
        """Check application metrics"""
        response = self.client.get("/api/metrics/", catch_response=True)
        
        if response.status_code == 200:
            response.success()
        else:
            response.failure(f"Metrics check failed: {response.status_code}")
    
    @task
    def check_api_keys_status(self):
        """Check API keys status"""
        response = self.client.get("/api/admin/api-keys/status/", catch_response=True)
        
        if response.status_code in [200, 401, 403]:  # Auth might fail
            response.success()
        else:
            response.failure(f"API keys status check failed: {response.status_code}")


# Event handlers for reporting
@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print("Load test starting...")
    print(f"Target host: {environment.host}")
    print(f"Test started at: {datetime.now()}")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    print("\nLoad test completed!")
    print(f"Test stopped at: {datetime.now()}")
    
    # Print summary statistics
    stats = environment.stats
    print(f"\nTotal requests: {stats.total.num_requests}")
    print(f"Total failures: {stats.total.num_failures}")
    print(f"Average response time: {stats.total.avg_response_time:.2f}ms")
    print(f"Min response time: {stats.total.min_response_time:.2f}ms")
    print(f"Max response time: {stats.total.max_response_time:.2f}ms")
    
    # Calculate success rate
    if stats.total.num_requests > 0:
        success_rate = ((stats.total.num_requests - stats.total.num_failures) / 
                       stats.total.num_requests) * 100
        print(f"Success rate: {success_rate:.2f}%")
    
    # Check if we met our targets
    print("\n=== Performance Targets ===")
    targets_met = []
    targets_failed = []
    
    # Target: <500ms average response time
    if stats.total.avg_response_time < 500:
        targets_met.append("✓ Average response time < 500ms")
    else:
        targets_failed.append(f"✗ Average response time: {stats.total.avg_response_time:.2f}ms (target: <500ms)")
    
    # Target: <1% error rate
    if stats.total.num_requests > 0:
        error_rate = (stats.total.num_failures / stats.total.num_requests) * 100
        if error_rate < 1:
            targets_met.append("✓ Error rate < 1%")
        else:
            targets_failed.append(f"✗ Error rate: {error_rate:.2f}% (target: <1%)")
    
    # Print results
    for target in targets_met:
        print(target)
    for target in targets_failed:
        print(target)


if __name__ == "__main__":
    import os
    os.system("locust -f load_test.py --host=http://localhost:8000")