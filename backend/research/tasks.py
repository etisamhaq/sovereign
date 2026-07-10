from celery import shared_task
import logging
from .models import ResearchProject
from .research_service import ResearchAIService

logger = logging.getLogger(__name__)


@shared_task
def conduct_research_task(project_id):
    """Celery task to conduct research asynchronously"""
    try:
        project = ResearchProject.objects.get(id=project_id)
        service = ResearchAIService()
        
        logger.info(f"Starting research for project {project_id}: {project.topic}")
        
        result = service.conduct_research(project)
        
        logger.info(f"Research completed for project {project_id}")
        
        return result
        
    except ResearchProject.DoesNotExist:
        logger.error(f"Research project {project_id} not found")
        return {'status': 'error', 'message': 'Project not found'}
    except Exception as e:
        logger.error(f"Research task failed for project {project_id}: {e}")
        # Mark project as failed
        try:
            project = ResearchProject.objects.get(id=project_id)
            project.status = 'failed'
            project.save()
        except:
            pass
        return {'status': 'error', 'message': str(e)}