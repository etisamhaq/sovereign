from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
import json

User = get_user_model()


class ResearchProject(models.Model):
    """Main research project model"""
    DEPTH_CHOICES = [
        ('quick', 'Quick Overview'),
        ('standard', 'Standard Research'),
        ('deep', 'Deep Analysis'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='research_projects')
    title = models.CharField(max_length=255)
    topic = models.TextField()
    depth_level = models.CharField(max_length=20, choices=DEPTH_CHOICES, default='standard')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Research settings
    max_sources = models.IntegerField(default=10)
    include_academic = models.BooleanField(default=True)
    include_news = models.BooleanField(default=True)
    include_web = models.BooleanField(default=True)
    
    # Results
    summary = models.TextField(blank=True)
    key_findings = models.JSONField(default=list, blank=True)
    knowledge_map_data = models.JSONField(default=dict, blank=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    processing_time = models.FloatField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        
    def __str__(self):
        return f"{self.title} - {self.user.email}"
    
    def mark_completed(self):
        self.status = 'completed'
        self.completed_at = timezone.now()
        self.save()


class ResearchSource(models.Model):
    """Individual source found during research"""
    SOURCE_TYPES = [
        ('academic', 'Academic Paper'),
        ('news', 'News Article'),
        ('wikipedia', 'Wikipedia'),
        ('web', 'Web Page'),
        ('book', 'Book'),
        ('report', 'Report'),
    ]
    
    project = models.ForeignKey(ResearchProject, on_delete=models.CASCADE, related_name='sources')
    url = models.URLField(max_length=500)
    title = models.CharField(max_length=500)
    authors = models.JSONField(default=list, blank=True)  # List of author names
    publication_date = models.DateField(null=True, blank=True)
    
    # Content
    content_summary = models.TextField()
    key_points = models.JSONField(default=list, blank=True)  # List of key points
    
    # Metadata
    source_type = models.CharField(max_length=50, choices=SOURCE_TYPES)
    credibility_score = models.FloatField(default=0.5)  # 0-1 score
    relevance_score = models.FloatField(default=0.5)  # 0-1 score
    
    # Citation info
    citation_text = models.TextField(blank=True)
    bibtex = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-credibility_score', '-relevance_score']
        
    def __str__(self):
        return f"{self.title} ({self.source_type})"


class ResearchFact(models.Model):
    """Individual facts extracted from sources"""
    CONFIDENCE_LEVELS = [
        ('high', 'High Confidence'),
        ('medium', 'Medium Confidence'),
        ('low', 'Low Confidence'),
        ('disputed', 'Disputed'),
    ]
    
    project = models.ForeignKey(ResearchProject, on_delete=models.CASCADE, related_name='facts')
    fact = models.TextField()
    context = models.TextField(blank=True)  # Additional context for the fact
    
    # Verification
    sources = models.ManyToManyField(ResearchSource, related_name='facts')
    confidence_level = models.CharField(max_length=20, choices=CONFIDENCE_LEVELS)
    confidence_score = models.FloatField(default=0.5)  # 0-1 score
    is_disputed = models.BooleanField(default=False)
    dispute_details = models.TextField(blank=True)
    
    # Categorization
    category = models.CharField(max_length=100, blank=True)
    tags = models.JSONField(default=list, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-confidence_score', 'created_at']
        
    def __str__(self):
        return f"{self.fact[:100]}... ({self.confidence_level})"


class KnowledgeNode(models.Model):
    """Nodes for knowledge graph/mind map"""
    NODE_TYPES = [
        ('concept', 'Concept'),
        ('person', 'Person'),
        ('event', 'Event'),
        ('place', 'Place'),
        ('date', 'Date'),
        ('organization', 'Organization'),
        ('topic', 'Topic'),
    ]
    
    project = models.ForeignKey(ResearchProject, on_delete=models.CASCADE, related_name='knowledge_nodes')
    node_id = models.CharField(max_length=100, unique=True)
    label = models.CharField(max_length=255)
    node_type = models.CharField(max_length=50, choices=NODE_TYPES, default='concept')
    
    # Node data
    description = models.TextField(blank=True)
    importance_score = models.FloatField(default=0.5)  # 0-1 score
    
    # Visual properties for graph
    x_position = models.FloatField(null=True, blank=True)
    y_position = models.FloatField(null=True, blank=True)
    color = models.CharField(max_length=7, default='#6366f1')  # Hex color
    size = models.IntegerField(default=10)
    
    # Related facts and sources
    related_facts = models.ManyToManyField(ResearchFact, blank=True)
    related_sources = models.ManyToManyField(ResearchSource, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-importance_score']
        unique_together = ['project', 'node_id']
        
    def __str__(self):
        return f"{self.label} ({self.node_type})"


class KnowledgeEdge(models.Model):
    """Edges/relationships for knowledge graph"""
    RELATIONSHIP_TYPES = [
        ('related_to', 'Related To'),
        ('causes', 'Causes'),
        ('caused_by', 'Caused By'),
        ('part_of', 'Part Of'),
        ('contains', 'Contains'),
        ('contradicts', 'Contradicts'),
        ('supports', 'Supports'),
        ('preceded_by', 'Preceded By'),
        ('followed_by', 'Followed By'),
    ]
    
    project = models.ForeignKey(ResearchProject, on_delete=models.CASCADE, related_name='knowledge_edges')
    source_node = models.ForeignKey(KnowledgeNode, on_delete=models.CASCADE, related_name='outgoing_edges')
    target_node = models.ForeignKey(KnowledgeNode, on_delete=models.CASCADE, related_name='incoming_edges')
    
    relationship_type = models.CharField(max_length=50, choices=RELATIONSHIP_TYPES)
    strength = models.FloatField(default=0.5)  # 0-1 score
    description = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['project', 'source_node', 'target_node', 'relationship_type']
        
    def __str__(self):
        return f"{self.source_node.label} -{self.relationship_type}-> {self.target_node.label}"


class ResearchExport(models.Model):
    """Track exported research reports"""
    FORMAT_CHOICES = [
        ('pdf', 'PDF'),
        ('docx', 'Word Document'),
        ('md', 'Markdown'),
        ('html', 'HTML'),
        ('json', 'JSON'),
    ]
    
    project = models.ForeignKey(ResearchProject, on_delete=models.CASCADE, related_name='exports')
    format = models.CharField(max_length=10, choices=FORMAT_CHOICES)
    file_path = models.CharField(max_length=500)
    file_size = models.IntegerField()  # in bytes
    
    # Export options
    include_sources = models.BooleanField(default=True)
    include_knowledge_map = models.BooleanField(default=True)
    include_facts = models.BooleanField(default=True)
    include_citations = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        
    def __str__(self):
        return f"{self.project.title} - {self.format.upper()}"