from rest_framework import status, serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.utils import timezone
from django.db.models import Count, Sum, Q, F, Avg
from django.db.models.functions import TruncDate, ExtractHour
from django.core.mail import send_mail
from django.conf import settings as django_settings
from datetime import datetime, timedelta
import logging
import json

from tools.models import ToolUsage, Tool
from tools.ai_service import AIService

logger = logging.getLogger(__name__)


class DashboardStatsView(APIView):
    """Get comprehensive dashboard statistics for the authenticated user"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        try:
            # Calculate time saved (estimate: 5 minutes per tool usage)
            total_usage = ToolUsage.objects.filter(user=user).count()
            time_saved_minutes = total_usage * 5
            time_saved_hours = round(time_saved_minutes / 60, 1)

            # Get unique tools used count
            tools_used_count = ToolUsage.objects.filter(user=user).values('tool').distinct().count()

            # Calculate changes from last month
            today = timezone.now()
            start_of_month = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            last_month_start = (start_of_month - timedelta(days=1)).replace(day=1)

            # Current month usage
            current_month_usage = ToolUsage.objects.filter(
                user=user,
                created_at__gte=start_of_month
            ).count()

            # Last month usage
            last_month_usage = ToolUsage.objects.filter(
                user=user,
                created_at__gte=last_month_start,
                created_at__lt=start_of_month
            ).count()

            # Calculate percentage change
            if last_month_usage > 0:
                usage_change = ((current_month_usage - last_month_usage) / last_month_usage) * 100
            else:
                usage_change = 100 if current_month_usage > 0 else 0

            # Get recent tool usage (last 5)
            recent_usage = ToolUsage.objects.filter(user=user).select_related('tool').order_by('-created_at')[:5]
            recent_tools = []

            for usage in recent_usage:
                recent_tools.append({
                    'id': usage.tool.slug,
                    'name': usage.tool.name,
                    'icon': usage.tool.icon,
                    'lastUsed': usage.created_at,
                    'processing_time': usage.processing_time,
                })

            # Get most used tools
            popular_tools = ToolUsage.objects.filter(user=user).values(
                'tool__id', 'tool__name', 'tool__category', 'tool__slug'
            ).annotate(
                usage_count=Count('id')
            ).order_by('-usage_count')[:6]

            # Format popular tools
            formatted_popular_tools = []
            for tool in popular_tools:
                formatted_popular_tools.append({
                    'id': tool['tool__slug'],
                    'name': tool['tool__name'],
                    'category': tool['tool__category'],
                    'usageCount': tool['usage_count'],
                })

            # Get usage trend for last 7 days (single aggregated query)
            seven_days_ago = today - timedelta(days=6)
            trend_qs = ToolUsage.objects.filter(
                user=user,
                created_at__date__gte=seven_days_ago.date()
            ).annotate(
                day=TruncDate('created_at')
            ).values('day').annotate(
                count=Count('id')
            ).order_by('day')

            # Build a complete 7-day list (fill gaps with 0)
            trend_map = {item['day']: item['count'] for item in trend_qs}
            usage_trend = []
            for i in range(7):
                date = (seven_days_ago + timedelta(days=i)).date()
                usage_trend.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'count': trend_map.get(date, 0)
                })

            # Get tool usage by category
            tool_categories = ToolUsage.objects.filter(user=user).values(
                'tool__category'
            ).annotate(
                count=Count('id')
            ).order_by('-count')

            # Get user's usage limit and current usage
            usage_limit = user.get_usage_limit()
            current_usage = user.monthly_usage_count
            usage_percentage = (current_usage / usage_limit) * 100 if usage_limit > 0 else 0

            response_data = {
                'stats': {
                    'monthly_usage': {
                        'current': current_usage,
                        'limit': usage_limit,
                        'percentage': usage_percentage,
                        'change': f"+{int(usage_change)}%" if usage_change > 0 else f"{int(usage_change)}%",
                        'changeType': 'positive' if usage_change > 0 else 'negative' if usage_change < 0 else 'neutral',
                    },
                    'tools_used': {
                        'value': tools_used_count,
                        'change': f'+{tools_used_count}' if tools_used_count > 0 else '0',
                        'changeType': 'positive' if tools_used_count > 0 else 'neutral',
                    },
                    'time_saved': {
                        'value': f'{time_saved_hours} hrs',
                        'change': f'+{round(time_saved_hours * 0.2, 1)} hrs',  # Estimate 20% increase
                        'changeType': 'positive' if time_saved_hours > 0 else 'neutral',
                    },
                },
                'recentTools': recent_tools,
                'popularTools': formatted_popular_tools,
                'usageTrend': usage_trend,
                'toolCategories': list(tool_categories),
            }

            return Response(response_data)

        except Exception as e:
            logger.error(f"Dashboard stats error: {e}")
            return Response(
                {'error': 'Failed to fetch dashboard statistics'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserActivityView(APIView):
    """Get detailed user activity and tool usage history"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        limit = int(request.query_params.get('limit', 10))
        offset = int(request.query_params.get('offset', 0))

        # Get tool usage with details
        activities = ToolUsage.objects.filter(
            user=user
        ).select_related('tool').order_by('-created_at')[offset:offset + limit]

        activity_data = []
        for activity in activities:
            activity_data.append({
                'id': str(activity.id),
                'tool': {
                    'id': activity.tool.slug,
                    'name': activity.tool.name,
                    'category': activity.tool.category,
                    'icon': activity.tool.icon,
                },
                'created_at': activity.created_at,
                'processing_time': activity.processing_time,
                'tokens_used': activity.tokens_used,
                'success': activity.error_message == '',
                'input_preview': activity.input_data.get('text', '')[:100] if activity.input_data else '',
                'output_preview': activity.output_data.get('result', '')[:100] if activity.output_data else '',
            })

        total_count = ToolUsage.objects.filter(user=user).count()

        return Response({
            'results': activity_data,
            'count': total_count,
            'next': offset + limit < total_count,
            'previous': offset > 0,
        })


class ToolUsageAnalyticsView(APIView):
    """Get detailed analytics for tool usage"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        period = request.query_params.get('period', '7d')  # 7d, 30d, 90d

        # Calculate date range
        end_date = timezone.now()
        if period == '7d':
            start_date = end_date - timedelta(days=7)
        elif period == '30d':
            start_date = end_date - timedelta(days=30)
        elif period == '90d':
            start_date = end_date - timedelta(days=90)
        else:
            start_date = end_date - timedelta(days=7)

        # Get usage by date (single aggregated query)
        date_qs = ToolUsage.objects.filter(
            user=user,
            created_at__gte=start_date
        ).annotate(
            day=TruncDate('created_at')
        ).values('day').annotate(
            count=Count('id')
        ).order_by('day')

        # Build a complete day list filling gaps with 0
        date_map = {item['day']: item['count'] for item in date_qs}
        usage_by_date = []
        current_date = start_date.date()
        while current_date <= end_date.date():
            usage_by_date.append({
                'date': current_date.strftime('%Y-%m-%d'),
                'count': date_map.get(current_date, 0),
            })
            current_date += timedelta(days=1)

        # Get usage by tool
        usage_by_tool = ToolUsage.objects.filter(
            user=user,
            created_at__gte=start_date
        ).values(
            'tool__name', 'tool__category'
        ).annotate(
            count=Count('id'),
            avg_processing_time=Avg('processing_time')
        ).order_by('-count')[:10]

        # Get usage by time of day (single aggregated query)
        hour_qs = ToolUsage.objects.filter(
            user=user,
            created_at__gte=start_date
        ).annotate(
            hr=ExtractHour('created_at')
        ).values('hr').annotate(
            count=Count('id')
        ).order_by('hr')

        hour_map = {item['hr']: item['count'] for item in hour_qs}
        usage_by_hour = [
            {'hour': h, 'count': hour_map.get(h, 0)}
            for h in range(24)
        ]

        # Calculate success rate
        total_usage = ToolUsage.objects.filter(
            user=user,
            created_at__gte=start_date
        ).count()

        successful_usage = ToolUsage.objects.filter(
            user=user,
            created_at__gte=start_date,
            error_message=''
        ).count()

        success_rate = (successful_usage / total_usage * 100) if total_usage > 0 else 100

        return Response({
            'period': period,
            'usage_by_date': usage_by_date,
            'usage_by_tool': list(usage_by_tool),
            'usage_by_hour': usage_by_hour,
            'metrics': {
                'total_usage': total_usage,
                'success_rate': round(success_rate, 1),
                'avg_daily_usage': round(total_usage / len(usage_by_date), 1) if usage_by_date else 0,
            }
        })


class ContactFormSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    subject = serializers.CharField(max_length=255)
    message = serializers.CharField(min_length=10)


class ContactFormView(APIView):
    """Handle contact form submissions — sends email to site admin."""
    permission_classes = [AllowAny]
    serializer_class = ContactFormSerializer

    def post(self, request):
        serializer = ContactFormSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        admin_email = getattr(django_settings, 'CONTACT_FORM_EMAIL', django_settings.DEFAULT_FROM_EMAIL)
        subject = f"[Sovereign Contact] {data['subject']}"
        body = (
            f"New contact form submission:\n\n"
            f"Name: {data['name']}\n"
            f"Email: {data['email']}\n"
            f"Subject: {data['subject']}\n\n"
            f"Message:\n{data['message']}"
        )

        try:
            send_mail(
                subject,
                body,
                django_settings.DEFAULT_FROM_EMAIL,
                [admin_email],
                fail_silently=False,
            )
        except Exception as e:
            logger.error(f"Contact form email failed: {e}")
            # Still return success — we don't want to expose email config issues
            # Log it and maybe store in DB in the future

        return Response({
            'message': 'Message sent successfully! We\'ll get back to you soon.'
        })


# ── AI Chatbot ────────────────────────────────────────────────────

class ChatbotMessageSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=1000)
    conversation_history = serializers.ListField(
        child=serializers.DictField(), required=False, default=list
    )


class ChatbotView(APIView):
    """AI chatbot that helps users find and navigate to the right tools."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChatbotMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_message = serializer.validated_data['message']
        conversation_history = serializer.validated_data.get('conversation_history', [])

        # Fetch all active tools from the database
        tools = Tool.objects.filter(is_active=True, is_implemented=True)
        tool_catalog = self._build_tool_catalog(tools)

        # Build the AI prompt
        system_prompt = self._build_system_prompt(tool_catalog, request.user)
        messages = [{'role': 'system', 'content': system_prompt}]

        # Add conversation history (last 10 messages max)
        for msg in conversation_history[-10:]:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            if role in ('user', 'assistant') and content:
                messages.append({'role': role, 'content': content})

        messages.append({'role': 'user', 'content': user_message})

        try:
            ai_service = AIService()
            raw_response = ai_service._generate_completion(
                messages=messages,
                temperature=0.6,
                max_tokens=800,
                use_cache=False,
            )

            # Parse the AI response
            parsed = self._parse_response(raw_response, tools)
            return Response(parsed)

        except Exception as e:
            logger.error(f"Chatbot error: {e}")
            # Fallback: keyword-based tool matching
            fallback = self._keyword_fallback(user_message, tools)
            return Response(fallback)

    def _build_tool_catalog(self, tools):
        """Build a concise tool catalog string for the AI prompt."""
        lines = []
        for t in tools:
            premium_tag = ' [PRO]' if t.is_premium else ''
            lines.append(
                f"- slug:{t.slug} | name:{t.name} | category:{t.category} | "
                f"desc:{t.description[:120]}{premium_tag}"
            )
        return '\n'.join(lines)

    def _build_system_prompt(self, tool_catalog, user):
        is_pro = user.is_pro
        tier = 'Pro' if is_pro else 'Free'
        return f"""You are Sovereign Assistant, a helpful AI chatbot for the Sovereign writing platform.
Your job is to help users find the right AI tool for their task.

AVAILABLE TOOLS:
{tool_catalog}

USER INFO: {tier} tier user.

RULES:
1. Understand what the user wants to do and recommend the best matching tool(s).
2. Be conversational, friendly, and concise (2-3 sentences max for the message).
3. If the user asks a general question (greetings, help, what can you do), give a brief overview and suggest popular tools.
4. If the user's task matches specific tools, recommend 1-3 tools maximum.
5. If no tool matches, say so honestly and suggest browsing the tools page.
6. For Pro-only tools, mention that they require a Pro subscription if the user is on Free tier.

RESPONSE FORMAT — you MUST respond with valid JSON only, no markdown, no code fences:
{{
  "message": "Your friendly response text here",
  "recommended_tools": ["slug-1", "slug-2"]
}}

If no tools match, use an empty array: "recommended_tools": []
IMPORTANT: Return ONLY the JSON object. No extra text before or after."""

    def _parse_response(self, raw_response, tools):
        """Parse AI response and enrich with tool data."""
        # Clean the response — strip markdown fences if present
        cleaned = raw_response.strip()
        if cleaned.startswith('```'):
            cleaned = cleaned.split('\n', 1)[-1]
        if cleaned.endswith('```'):
            cleaned = cleaned.rsplit('```', 1)[0]
        cleaned = cleaned.strip()

        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError:
            # Try to extract JSON from the response
            start = cleaned.find('{')
            end = cleaned.rfind('}') + 1
            if start >= 0 and end > start:
                try:
                    data = json.loads(cleaned[start:end])
                except json.JSONDecodeError:
                    data = {'message': cleaned, 'recommended_tools': []}
            else:
                data = {'message': cleaned, 'recommended_tools': []}

        message = data.get('message', 'I can help you find the right tool!')
        slugs = data.get('recommended_tools', [])

        # Enrich tool slugs with full tool data
        recommended = []
        tool_map = {t.slug: t for t in tools}
        for slug in slugs:
            if slug in tool_map:
                t = tool_map[slug]
                recommended.append({
                    'slug': t.slug,
                    'name': t.name,
                    'description': t.description[:150],
                    'category': t.category,
                    'icon': t.icon,
                    'is_premium': t.is_premium,
                    'url': f'/tools/{t.slug}',
                })

        return {
            'message': message,
            'recommended_tools': recommended,
        }

    def _keyword_fallback(self, user_message, tools):
        """Simple keyword-based fallback when AI fails."""
        msg_lower = user_message.lower()
        matches = []

        for t in tools:
            score = 0
            name_lower = t.name.lower()
            desc_lower = t.description.lower()
            slug_lower = t.slug.replace('-', ' ')

            # Check name, slug, description, category for keyword overlap
            words = msg_lower.split()
            for word in words:
                if len(word) < 3:
                    continue
                if word in name_lower:
                    score += 3
                if word in slug_lower:
                    score += 3
                if word in desc_lower:
                    score += 1
                if word in t.category:
                    score += 2

            if score > 0:
                matches.append((score, t))

        matches.sort(key=lambda x: x[0], reverse=True)
        top = matches[:3]

        if top:
            tool_names = ', '.join(t.name for _, t in top)
            message = f"Based on your request, I'd recommend: {tool_names}. Click on any tool below to get started!"
        else:
            message = ("I'm not sure which tool fits best. You can browse all our tools "
                       "on the Tools page to find what you need!")

        recommended = []
        for _, t in top:
            recommended.append({
                'slug': t.slug,
                'name': t.name,
                'description': t.description[:150],
                'category': t.category,
                'icon': t.icon,
                'is_premium': t.is_premium,
                'url': f'/tools/{t.slug}',
            })

        return {
            'message': message,
            'recommended_tools': recommended,
        }