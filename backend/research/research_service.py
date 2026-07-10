import logging
from typing import List, Dict, Optional, Tuple
import json
import networkx as nx
from datetime import datetime
import uuid

from django.conf import settings
from django.db import transaction

from tools.ai_service import AIService
from .models import (
    ResearchProject, ResearchSource, ResearchFact,
    KnowledgeNode, KnowledgeEdge
)
from .scraping_service import WebScrapingService

logger = logging.getLogger(__name__)


class ResearchAIService:
    """AI-powered research service"""
    
    def __init__(self):
        self.ai_service = AIService()
        self.scraping_service = WebScrapingService()
        
    def conduct_research(self, project: ResearchProject) -> Dict:
        """Main research orchestration method"""
        try:
            # Update project status
            project.status = 'processing'
            project.save()
            
            # 1. Expand search queries
            search_queries = self._generate_search_queries(project.topic, project.depth_level)
            
            # 2. Collect sources
            sources = self._collect_sources(project, search_queries)
            
            # 3. Extract facts from sources
            facts = self._extract_facts(project, sources)
            
            # 4. Build knowledge graph
            knowledge_graph = self._build_knowledge_graph(project, facts)
            
            # 5. Generate comprehensive summary
            summary = self._generate_research_summary(project, sources, facts)
            
            # 6. Extract key findings
            key_findings = self._extract_key_findings(facts, summary)
            
            # Update project with results
            project.summary = summary
            project.key_findings = key_findings
            project.knowledge_map_data = self._serialize_knowledge_graph(knowledge_graph)
            project.mark_completed()
            
            return {
                'status': 'success',
                'summary': summary,
                'key_findings': key_findings,
                'sources_count': len(sources),
                'facts_count': len(facts),
                'nodes_count': knowledge_graph.number_of_nodes() if knowledge_graph else 0,
            }
            
        except Exception as e:
            logger.error(f"Research failed for project {project.id}: {e}")
            project.status = 'failed'
            project.save()
            raise
    
    def _generate_search_queries(self, topic: str, depth_level: str) -> List[str]:
        """Generate multiple search queries for comprehensive research"""
        messages = [
            {"role": "system", "content": "You are a research assistant that generates comprehensive search queries."},
            {"role": "user", "content": f"""Generate search queries for researching: "{topic}"
            
            Depth level: {depth_level}
            
            Generate {5 if depth_level == 'quick' else 10 if depth_level == 'standard' else 15} different search queries that would help gather comprehensive information about this topic.
            Include queries for:
            - General overview
            - Specific aspects
            - Recent developments
            - Key figures/organizations
            - Controversies or debates
            
            Return ONLY a JSON array of search queries."""}
        ]
        
        try:
            response = self.ai_service._generate_completion(messages, temperature=0.7)
            # Clean response and parse JSON
            response = response.strip()
            if response.startswith('```'):
                response = response.split('```')[1]
                if response.startswith('json'):
                    response = response[4:]
            queries = json.loads(response)
            
            # Always include the original topic
            if topic not in queries:
                queries.insert(0, topic)
                
            return queries
        except Exception as e:
            logger.error(f"Failed to generate search queries: {e}")
            # Fallback queries
            return [
                topic,
                f"{topic} overview",
                f"{topic} facts",
                f"{topic} recent news",
                f"{topic} research",
            ]
    
    def _collect_sources(self, project: ResearchProject, search_queries: List[str]) -> List[ResearchSource]:
        """Collect sources from the web"""
        sources = []
        urls_seen = set()
        
        for query in search_queries[:project.max_sources]:
            # Get URLs for this query
            urls = self.scraping_service.search_web(query, max_results=3)
            
            for url in urls:
                if url in urls_seen or len(sources) >= project.max_sources:
                    continue
                    
                urls_seen.add(url)
                
                # Scrape content
                source_data = self.scraping_service.scrape_url(url)
                if not source_data:
                    continue
                
                # Calculate scores
                credibility_score = self.scraping_service.calculate_credibility_score(source_data)
                relevance_score = self._calculate_relevance_score(source_data, project.topic)
                
                # Get citations
                citations = self.scraping_service.extract_citations(source_data)
                
                # Create source object
                source = ResearchSource.objects.create(
                    project=project,
                    url=url,
                    title=source_data['title'],
                    authors=source_data.get('authors', []),
                    publication_date=source_data.get('publication_date'),
                    content_summary=source_data.get('summary', '')[:1000],
                    key_points=source_data.get('key_points', []),
                    source_type=source_data.get('source_type', 'web'),
                    credibility_score=credibility_score,
                    relevance_score=relevance_score,
                    citation_text=citations.get('apa', ''),
                    bibtex=citations.get('bibtex', ''),
                )
                sources.append(source)
        
        return sources
    
    def _calculate_relevance_score(self, source_data: Dict, topic: str) -> float:
        """Calculate how relevant a source is to the research topic"""
        messages = [
            {"role": "system", "content": "You are a research assistant that evaluates source relevance."},
            {"role": "user", "content": f"""Rate the relevance of this source to the research topic.
            
            Research topic: "{topic}"
            
            Source title: {source_data.get('title', 'Unknown')}
            Source summary: {source_data.get('summary', '')[:500]}
            
            Return ONLY a number between 0 and 1 representing the relevance score, where:
            - 0 = completely irrelevant
            - 0.5 = somewhat relevant
            - 1 = highly relevant
            
            Consider:
            - Direct topic match
            - Related concepts
            - Useful background information"""}
        ]
        
        try:
            response = self.ai_service._generate_completion(messages, temperature=0.3)
            score = float(response.strip())
            return min(max(score, 0), 1)  # Ensure between 0 and 1
        except:
            # Fallback: simple keyword matching
            topic_words = topic.lower().split()
            content = f"{source_data.get('title', '')} {source_data.get('summary', '')}".lower()
            matches = sum(1 for word in topic_words if word in content)
            return min(matches / len(topic_words), 1) if topic_words else 0.5
    
    def _extract_facts(self, project: ResearchProject, sources: List[ResearchSource]) -> List[ResearchFact]:
        """Extract facts from sources"""
        facts = []
        
        for source in sources:
            # Use AI to extract facts
            messages = [
                {"role": "system", "content": "You are a research assistant that extracts key facts from sources."},
                {"role": "user", "content": f"""Extract important facts from this source about "{project.topic}".
                
                Source: {source.title}
                Content: {source.content_summary}
                Key points: {json.dumps(source.key_points)}
                
                Extract 3-5 important facts. For each fact:
                - State it clearly and concisely
                - Indicate confidence level (high/medium/low)
                - Provide brief context if needed
                
                Return as a JSON array with objects containing:
                - fact: the fact statement
                - confidence: confidence level
                - context: brief context (optional)
                - category: fact category (e.g., "statistics", "history", "definition", etc.)"""}
            ]
            
            try:
                response = self.ai_service._generate_completion(messages)
                # Parse response
                response = response.strip()
                if response.startswith('```'):
                    response = response.split('```')[1]
                    if response.startswith('json'):
                        response = response[4:]
                        
                extracted_facts = json.loads(response)
                
                for fact_data in extracted_facts:
                    # Create fact object
                    confidence_map = {'high': 0.9, 'medium': 0.7, 'low': 0.5}
                    fact = ResearchFact.objects.create(
                        project=project,
                        fact=fact_data['fact'],
                        context=fact_data.get('context', ''),
                        confidence_level=fact_data.get('confidence', 'medium'),
                        confidence_score=confidence_map.get(fact_data.get('confidence', 'medium'), 0.7),
                        category=fact_data.get('category', 'general'),
                    )
                    fact.sources.add(source)
                    facts.append(fact)
                    
            except Exception as e:
                logger.error(f"Failed to extract facts from source {source.id}: {e}")
                continue
        
        # Cross-reference facts to identify disputes
        self._cross_reference_facts(facts)
        
        return facts
    
    def _cross_reference_facts(self, facts: List[ResearchFact]):
        """Cross-reference facts to identify contradictions"""
        # Simple contradiction detection
        for i, fact1 in enumerate(facts):
            for fact2 in facts[i+1:]:
                if self._facts_contradict(fact1.fact, fact2.fact):
                    fact1.is_disputed = True
                    fact2.is_disputed = True
                    fact1.dispute_details = f"Contradicts: {fact2.fact}"
                    fact2.dispute_details = f"Contradicts: {fact1.fact}"
                    fact1.save()
                    fact2.save()
    
    def _facts_contradict(self, fact1: str, fact2: str) -> bool:
        """Check if two facts contradict each other"""
        messages = [
            {"role": "system", "content": "You are a fact checker that identifies contradictions."},
            {"role": "user", "content": f"""Do these two facts contradict each other?
            
            Fact 1: {fact1}
            Fact 2: {fact2}
            
            Return ONLY "yes" or "no"."""}
        ]
        
        try:
            response = self.ai_service._generate_completion(messages, temperature=0.1)
            return response.strip().lower() == 'yes'
        except:
            return False
    
    def _build_knowledge_graph(self, project: ResearchProject, facts: List[ResearchFact]) -> nx.Graph:
        """Build a knowledge graph from facts"""
        G = nx.Graph()
        
        # Extract entities and relationships
        all_entities = []
        for fact in facts:
            entities = self._extract_entities_from_fact(fact)
            all_entities.extend(entities)
        
        # Create nodes
        nodes_created = {}
        for entity in all_entities:
            if entity['label'] not in nodes_created:
                node = KnowledgeNode.objects.create(
                    project=project,
                    node_id=str(uuid.uuid4()),
                    label=entity['label'],
                    node_type=entity['type'],
                    description=entity.get('description', ''),
                    importance_score=entity.get('importance', 0.5),
                )
                nodes_created[entity['label']] = node
                G.add_node(node.node_id, label=node.label, type=node.node_type)
        
        # Create edges based on co-occurrence and relationships
        for fact in facts:
            entities_in_fact = self._extract_entities_from_fact(fact)
            # Connect entities that appear in the same fact
            for i, entity1 in enumerate(entities_in_fact):
                for entity2 in entities_in_fact[i+1:]:
                    if entity1['label'] != entity2['label']:
                        node1 = nodes_created[entity1['label']]
                        node2 = nodes_created[entity2['label']]
                        
                        # Check if edge already exists
                        existing_edge = KnowledgeEdge.objects.filter(
                            project=project,
                            source_node=node1,
                            target_node=node2
                        ).first()
                        
                        if not existing_edge:
                            edge = KnowledgeEdge.objects.create(
                                project=project,
                                source_node=node1,
                                target_node=node2,
                                relationship_type='related_to',
                                strength=0.5,
                                description=f"Co-occurs in fact: {fact.fact[:100]}..."
                            )
                            G.add_edge(node1.node_id, node2.node_id)
        
        # Apply layout algorithm
        if G.number_of_nodes() > 0:
            pos = nx.spring_layout(G, k=2, iterations=50)
            for node_id, (x, y) in pos.items():
                node = KnowledgeNode.objects.get(project=project, node_id=node_id)
                node.x_position = float(x)
                node.y_position = float(y)
                node.save()
        
        return G
    
    def _extract_entities_from_fact(self, fact: ResearchFact) -> List[Dict]:
        """Extract entities from a fact"""
        messages = [
            {"role": "system", "content": "You are an entity extraction expert."},
            {"role": "user", "content": f"""Extract key entities from this fact:
            
            "{fact.fact}"
            
            Identify:
            - People (person)
            - Organizations (organization)
            - Places (place)
            - Concepts (concept)
            - Events (event)
            - Dates (date)
            
            Return as JSON array with objects containing:
            - label: entity name
            - type: entity type
            - importance: 0-1 score
            
            Extract only the most important 3-5 entities."""}
        ]
        
        try:
            response = self.ai_service._generate_completion(messages)
            response = response.strip()
            if response.startswith('```'):
                response = response.split('```')[1]
                if response.startswith('json'):
                    response = response[4:]
            return json.loads(response)
        except:
            # Fallback: extract based on capitalization
            words = fact.fact.split()
            entities = []
            for word in words:
                if word[0].isupper() and len(word) > 2:
                    entities.append({
                        'label': word,
                        'type': 'concept',
                        'importance': 0.5
                    })
            return entities[:5]
    
    def _generate_research_summary(self, project: ResearchProject, 
                                 sources: List[ResearchSource], 
                                 facts: List[ResearchFact]) -> str:
        """Generate comprehensive research summary"""
        # Prepare source summaries
        source_summaries = []
        for source in sources[:5]:  # Top 5 sources
            source_summaries.append(f"- {source.title}: {source.content_summary[:200]}...")
        
        # Prepare key facts
        key_facts = []
        for fact in sorted(facts, key=lambda f: f.confidence_score, reverse=True)[:10]:
            key_facts.append(f"- {fact.fact} (Confidence: {fact.confidence_level})")
        
        messages = [
            {"role": "system", "content": "You are an expert research synthesizer."},
            {"role": "user", "content": f"""Create a comprehensive research summary on: "{project.topic}"
            
            Based on {len(sources)} sources and {len(facts)} extracted facts.
            
            Top Sources:
            {chr(10).join(source_summaries)}
            
            Key Facts:
            {chr(10).join(key_facts)}
            
            Create a well-structured summary that:
            1. Provides an overview of the topic
            2. Highlights key findings
            3. Notes any controversies or conflicting information
            4. Suggests areas for further research
            
            Make it comprehensive but concise (around 500 words)."""}
        ]
        
        try:
            summary = self.ai_service._generate_completion(messages, max_tokens=1000)
            return summary
        except Exception as e:
            logger.error(f"Failed to generate summary: {e}")
            return f"Research on {project.topic} compiled from {len(sources)} sources."
    
    def _extract_key_findings(self, facts: List[ResearchFact], summary: str) -> List[str]:
        """Extract key findings from research"""
        messages = [
            {"role": "system", "content": "You are a research analyst extracting key findings."},
            {"role": "user", "content": f"""Extract 5-7 key findings from this research summary:
            
            {summary}
            
            Return as a JSON array of strings, each being a concise key finding."""}
        ]
        
        try:
            response = self.ai_service._generate_completion(messages)
            response = response.strip()
            if response.startswith('```'):
                response = response.split('```')[1]
                if response.startswith('json'):
                    response = response[4:]
            return json.loads(response)
        except:
            # Fallback: extract first few facts
            return [fact.fact for fact in facts[:5]]
    
    def _serialize_knowledge_graph(self, graph: nx.Graph) -> Dict:
        """Serialize NetworkX graph to JSON format"""
        if not graph or graph.number_of_nodes() == 0:
            return {'nodes': [], 'edges': []}
        
        nodes = []
        for node_id in graph.nodes():
            node = KnowledgeNode.objects.filter(node_id=node_id).first()
            if node:
                nodes.append({
                    'id': node.node_id,
                    'label': node.label,
                    'type': node.node_type,
                    'x': node.x_position or 0,
                    'y': node.y_position or 0,
                    'size': node.size,
                    'color': node.color,
                    'importance': node.importance_score,
                })
        
        edges = []
        for edge in KnowledgeEdge.objects.filter(
            source_node__node_id__in=graph.nodes(),
            target_node__node_id__in=graph.nodes()
        ):
            edges.append({
                'source': edge.source_node.node_id,
                'target': edge.target_node.node_id,
                'type': edge.relationship_type,
                'strength': edge.strength,
            })
        
        return {'nodes': nodes, 'edges': edges}