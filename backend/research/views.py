from rest_framework import generics, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet
from django.shortcuts import get_object_or_404
from django.db.models import Q, Count
from django.http import HttpResponse
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
import markdown
import json
from datetime import datetime
import logging

from .models import ResearchProject, ResearchSource, ResearchFact
from .serializers import (
    ResearchProjectSerializer, ResearchProjectListSerializer,
    CreateResearchProjectSerializer, ResearchSourceSerializer,
    ResearchFactSerializer, StartResearchSerializer
)
from .research_service import ResearchAIService
from .tasks import conduct_research_task

logger = logging.getLogger(__name__)


class ResearchProjectViewSet(ModelViewSet):
    """ViewSet for research projects"""
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ResearchProject.objects.filter(user=self.request.user).annotate(
            sources_count=Count('sources'),
            facts_count=Count('facts')
        )

    def get_serializer_class(self):
        if self.action == 'list':
            return ResearchProjectListSerializer
        elif self.action == 'create':
            return CreateResearchProjectSerializer
        return ResearchProjectSerializer

    def perform_create(self, serializer):
        project = serializer.save(user=self.request.user)
        # Start research task asynchronously
        conduct_research_task.delay(project.id)

    @action(detail=True, methods=['post'])
    def restart(self, request, pk=None):
        """Restart a failed research project"""
        project = self.get_object()
        if project.status in ['failed', 'completed']:
            project.status = 'pending'
            project.save()
            conduct_research_task.delay(project.id)
            return Response({'status': 'Research restarted'})
        return Response(
            {'error': 'Can only restart failed or completed projects'},
            status=status.HTTP_400_BAD_REQUEST
        )

    @action(detail=True, methods=['get'])
    def sources(self, request, pk=None):
        """Get sources for a research project"""
        project = self.get_object()
        sources = project.sources.all()
        serializer = ResearchSourceSerializer(sources, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def facts(self, request, pk=None):
        """Get facts for a research project"""
        project = self.get_object()
        facts = project.facts.all()
        serializer = ResearchFactSerializer(facts, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def knowledge_map(self, request, pk=None):
        """Get knowledge map data for visualization"""
        project = self.get_object()
        return Response(project.knowledge_map_data or {'nodes': [], 'edges': []})

    @action(detail=True, methods=['get'])
    def export(self, request, pk=None):
        """Export research project in various formats"""
        project = self.get_object()
        format_type = request.query_params.get('export_format', request.query_params.get('format', 'pdf')).lower()

        if project.status != 'completed':
            return Response(
                {'error': 'Research must be completed before exporting'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if format_type == 'pdf':
            return self._export_pdf(project)
        elif format_type == 'docx':
            return self._export_docx(project)
        elif format_type == 'markdown':
            return self._export_markdown(project)
        elif format_type == 'json':
            return self._export_json(project)
        else:
            return Response(
                {'error': 'Invalid format. Supported formats: pdf, docx, markdown, json'},
                status=status.HTTP_400_BAD_REQUEST
            )

    def _export_pdf(self, project):
        """Export research as PDF"""
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="research_{project.id}.pdf"'

        # Create PDF document
        doc = SimpleDocTemplate(response, pagesize=letter)
        story = []
        styles = getSampleStyleSheet()

        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor='#2C3E50',
            spaceAfter=30
        )
        story.append(Paragraph(project.title, title_style))
        story.append(Spacer(1, 0.2*inch))

        # Metadata
        story.append(Paragraph(f"<b>Topic:</b> {project.topic}", styles['Normal']))
        story.append(Paragraph(f"<b>Generated on:</b> {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles['Normal']))
        story.append(Paragraph(f"<b>Research Depth:</b> {project.get_depth_level_display()}", styles['Normal']))
        story.append(Spacer(1, 0.3*inch))

        # Executive Summary
        story.append(Paragraph("Executive Summary", styles['Heading2']))
        story.append(Paragraph(project.summary or "No summary available.", styles['Normal']))
        story.append(Spacer(1, 0.3*inch))

        # Sources
        story.append(Paragraph("Sources", styles['Heading2']))
        for source in project.sources.all():
            story.append(Paragraph(f"<b>{source.title}</b>", styles['Normal']))
            story.append(Paragraph(f"Type: {source.get_source_type_display()} | Credibility: {source.credibility_score}/10", styles['Normal']))
            story.append(Paragraph(source.content_summary, styles['Normal']))
            story.append(Paragraph(f"<link href='{source.url}'>View Source</link>", styles['Normal']))
            story.append(Spacer(1, 0.2*inch))

        # Key Facts
        story.append(PageBreak())
        story.append(Paragraph("Key Facts", styles['Heading2']))
        for fact in project.facts.all():
            story.append(Paragraph(f"• {fact.fact}", styles['Normal']))
            story.append(Paragraph(f"  Confidence: {fact.confidence_score}/10", styles['Normal']))
            story.append(Spacer(1, 0.1*inch))

        # Build PDF
        doc.build(story)
        return response

    def _export_docx(self, project):
        """Export research as Word document"""
        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        response['Content-Disposition'] = f'attachment; filename="research_{project.id}.docx"'

        # Create Word document
        doc = Document()

        # Title
        title = doc.add_heading(project.title, 0)
        title.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER

        # Metadata
        doc.add_paragraph(f"Topic: {project.topic}")
        doc.add_paragraph(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        doc.add_paragraph(f"Research Depth: {project.get_depth_level_display()}")
        doc.add_paragraph()

        # Executive Summary
        doc.add_heading('Executive Summary', 1)
        doc.add_paragraph(project.summary or "No summary available.")
        doc.add_paragraph()

        # Sources
        doc.add_heading('Sources', 1)
        for source in project.sources.all():
            doc.add_heading(source.title, 2)
            doc.add_paragraph(f"Type: {source.get_source_type_display()} | Credibility: {source.credibility_score}/10")
            doc.add_paragraph(source.content_summary)
            doc.add_paragraph(f"URL: {source.url}")
            doc.add_paragraph()

        # Key Facts
        doc.add_page_break()
        doc.add_heading('Key Facts', 1)
        for fact in project.facts.all():
            p = doc.add_paragraph()
            p.add_run('• ').bold = True
            p.add_run(fact.fact)
            doc.add_paragraph(f"   Confidence: {fact.confidence_score}/10", style='List Continue')

        # Save document
        doc.save(response)
        return response

    def _export_markdown(self, project):
        """Export research as Markdown"""
        response = HttpResponse(content_type='text/markdown')
        response['Content-Disposition'] = f'attachment; filename="research_{project.id}.md"'

        # Build Markdown content
        content = []
        content.append(f"# {project.title}\n")
        content.append(f"**Topic:** {project.topic}  ")
        content.append(f"**Generated on:** {datetime.now().strftime('%Y-%m-%d %H:%M')}  ")
        content.append(f"**Research Depth:** {project.get_depth_level_display()}\n")

        content.append("## Executive Summary\n")
        content.append(f"{project.summary or 'No summary available.'}\n")

        content.append("## Sources\n")
        for source in project.sources.all():
            content.append(f"### {source.title}\n")
            content.append(f"*Type: {source.get_source_type_display()} | Credibility: {source.credibility_score}/10*\n")
            content.append(f"{source.content_summary}\n")
            content.append(f"[View Source]({source.url})\n")

        content.append("## Key Facts\n")
        for fact in project.facts.all():
            content.append(f"- {fact.fact}")
            content.append(f"  - *Confidence: {fact.confidence_score}/10*\n")

        content.append("## Knowledge Graph Statistics\n")
        content.append(f"- **Concepts Identified:** {project.knowledge_nodes.count()}")
        content.append(f"- **Relationships Found:** {project.knowledge_edges.count()}\n")

        response.write('\n'.join(content))
        return response

    def _export_json(self, project):
        """Export research as JSON"""
        serializer = ResearchProjectSerializer(project)
        response = HttpResponse(
            json.dumps(serializer.data, indent=2),
            content_type='application/json'
        )
        response['Content-Disposition'] = f'attachment; filename="research_{project.id}.json"'
        return response


class StartResearchView(APIView):
    """Start research through the tools API"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # Check if user has access to research tool
        # Temporarily disabled - all tools are free for now
        # if not request.user.is_pro:
        #     return Response(
        #         {'error': 'Research Assistant requires a Pro subscription'},
        #         status=status.HTTP_403_FORBIDDEN
        #     )

        serializer = StartResearchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Create research project
        project = ResearchProject.objects.create(
            user=request.user,
            title=f"Research: {serializer.validated_data['topic'][:50]}",
            topic=serializer.validated_data['topic'],
            depth_level=serializer.validated_data['depth_level'],
            max_sources=serializer.validated_data['max_sources'],
            include_academic=serializer.validated_data['include_academic'],
            include_news=serializer.validated_data['include_news'],
            include_web=serializer.validated_data['include_web'],
        )

        # Start research asynchronously
        conduct_research_task.delay(project.id)

        return Response({
            'project_id': project.id,
            'status': 'Research started',
            'message': 'Your research is being processed. Check back in a few minutes.'
        }, status=status.HTTP_201_CREATED)


class ResearchStatusView(APIView):
    """Check research status"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_id):
        project = get_object_or_404(
            ResearchProject,
            id=project_id,
            user=request.user
        )

        response_data = {
            'id': project.id,
            'status': project.status,
            'created_at': project.created_at,
            'completed_at': project.completed_at,
        }

        if project.status == 'completed':
            response_data.update({
                'summary': project.summary,
                'key_findings': project.key_findings,
                'sources_count': project.sources.count(),
                'facts_count': project.facts.count(),
            })

        return Response(response_data)


class ResearchSummaryView(APIView):
    """Get research summary for display"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_id):
        project = get_object_or_404(
            ResearchProject,
            id=project_id,
            user=request.user,
            status='completed'
        )

        # Get top sources
        top_sources = project.sources.order_by('-credibility_score', '-relevance_score')[:5]

        # Get high-confidence facts
        top_facts = project.facts.filter(
            confidence_score__gte=0.7
        ).order_by('-confidence_score')[:10]

        return Response({
            'project': {
                'id': project.id,
                'title': project.title,
                'topic': project.topic,
                'summary': project.summary,
                'key_findings': project.key_findings,
                'completed_at': project.completed_at,
            },
            'sources': ResearchSourceSerializer(top_sources, many=True).data,
            'facts': ResearchFactSerializer(top_facts, many=True).data,
            'knowledge_map': project.knowledge_map_data,
            'stats': {
                'total_sources': project.sources.count(),
                'total_facts': project.facts.count(),
                'disputed_facts': project.facts.filter(is_disputed=True).count(),
            }
        })