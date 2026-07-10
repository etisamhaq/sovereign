import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin
import time
import logging
from typing import List, Dict, Optional
from datetime import datetime
import re
from newspaper import Article
import wikipedia

logger = logging.getLogger(__name__)


class WebScrapingService:
    """Service for web scraping and content extraction"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        self.rate_limit_delay = 1  # seconds between requests
        
    def scrape_url(self, url: str) -> Optional[Dict]:
        """Scrape content from a single URL"""
        try:
            # Rate limiting
            time.sleep(self.rate_limit_delay)
            
            # Determine source type
            domain = urlparse(url).netloc.lower()
            
            if 'wikipedia.org' in domain:
                return self._scrape_wikipedia(url)
            else:
                return self._scrape_general_web(url)
                
        except Exception as e:
            logger.error(f"Error scraping {url}: {e}")
            return None
    
    def _scrape_wikipedia(self, url: str) -> Optional[Dict]:
        """Scrape Wikipedia articles"""
        try:
            # Extract page title from URL
            page_title = url.split('/wiki/')[-1].replace('_', ' ')
            page = wikipedia.page(page_title)
            
            # Extract sections
            sections = []
            content = page.content
            section_pattern = r'== (.*?) =='
            section_titles = re.findall(section_pattern, content)
            
            return {
                'url': url,
                'title': page.title,
                'authors': ['Wikipedia'],
                'publication_date': None,
                'content': page.content,
                'summary': page.summary,
                'key_points': section_titles[:10],  # First 10 sections
                'source_type': 'wikipedia',
                'images': page.images[:5] if hasattr(page, 'images') else [],
                'references': page.references[:20] if hasattr(page, 'references') else [],
            }
        except Exception as e:
            logger.error(f"Wikipedia scraping error: {e}")
            return None
    
    def _scrape_general_web(self, url: str) -> Optional[Dict]:
        """Scrape general web pages using newspaper3k"""
        try:
            article = Article(url)
            article.download()
            article.parse()
            article.nlp()
            
            # Extract publication date
            pub_date = None
            if article.publish_date:
                pub_date = article.publish_date.date()
            
            return {
                'url': url,
                'title': article.title,
                'authors': article.authors or [],
                'publication_date': pub_date,
                'content': article.text,
                'summary': article.summary,
                'key_points': self._extract_key_points(article.text),
                'source_type': self._determine_source_type(url, article),
                'images': article.images,
                'keywords': article.keywords,
            }
        except Exception as e:
            logger.error(f"Article extraction error: {e}")
            # Fallback to basic BeautifulSoup scraping
            return self._scrape_with_beautifulsoup(url)
    
    def _scrape_with_beautifulsoup(self, url: str) -> Optional[Dict]:
        """Fallback scraping method using BeautifulSoup"""
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract title
            title = soup.find('title')
            title = title.text.strip() if title else 'Untitled'
            
            # Extract main content
            # Try common content containers
            content_tags = ['article', 'main', 'div.content', 'div.post', 'div.entry-content']
            content = ""
            
            for tag in content_tags:
                if '.' in tag:
                    tag_name, class_name = tag.split('.')
                    element = soup.find(tag_name, class_=class_name)
                else:
                    element = soup.find(tag)
                
                if element:
                    content = element.get_text(strip=True, separator=' ')
                    break
            
            if not content:
                # Fallback to all paragraphs
                paragraphs = soup.find_all('p')
                content = ' '.join([p.get_text(strip=True) for p in paragraphs])
            
            # Extract meta description
            meta_desc = soup.find('meta', attrs={'name': 'description'})
            summary = meta_desc.get('content', '')[:500] if meta_desc else content[:500]
            
            return {
                'url': url,
                'title': title,
                'authors': [],
                'publication_date': None,
                'content': content,
                'summary': summary,
                'key_points': self._extract_key_points(content),
                'source_type': 'web',
                'images': [img.get('src') for img in soup.find_all('img')[:5]],
                'keywords': [],
            }
        except Exception as e:
            logger.error(f"BeautifulSoup scraping error: {e}")
            return None
    
    def _extract_key_points(self, text: str, max_points: int = 5) -> List[str]:
        """Extract key points from text"""
        # Simple extraction based on sentences containing certain patterns
        sentences = text.split('.')
        key_sentences = []
        
        # Patterns that often indicate important points
        key_patterns = [
            r'important',
            r'significant',
            r'research shows',
            r'studies indicate',
            r'according to',
            r'concluded that',
            r'found that',
            r'discovered',
            r'revealed',
            r'demonstrates',
        ]
        
        for sentence in sentences:
            sentence = sentence.strip()
            if len(sentence) < 20:  # Skip very short sentences
                continue
                
            for pattern in key_patterns:
                if re.search(pattern, sentence, re.IGNORECASE):
                    key_sentences.append(sentence)
                    break
            
            if len(key_sentences) >= max_points:
                break
        
        # If not enough key sentences found, take first few substantial sentences
        if len(key_sentences) < max_points:
            for sentence in sentences:
                sentence = sentence.strip()
                if len(sentence) > 50 and sentence not in key_sentences:
                    key_sentences.append(sentence)
                if len(key_sentences) >= max_points:
                    break
        
        return key_sentences[:max_points]
    
    def _determine_source_type(self, url: str, article=None) -> str:
        """Determine the type of source"""
        domain = urlparse(url).netloc.lower()
        
        # Academic domains
        academic_domains = ['arxiv.org', 'pubmed', 'scholar.google', 'jstor.org', 
                          'sciencedirect.com', 'springer.com', 'nature.com']
        if any(d in domain for d in academic_domains):
            return 'academic'
        
        # News domains
        news_domains = ['cnn.com', 'bbc.com', 'reuters.com', 'nytimes.com', 
                       'theguardian.com', 'wsj.com', 'bloomberg.com']
        if any(d in domain for d in news_domains):
            return 'news'
        
        # Check if it looks like a news article
        if article and hasattr(article, 'publish_date') and article.publish_date:
            return 'news'
        
        return 'web'
    
    def calculate_credibility_score(self, source_data: Dict) -> float:
        """Calculate credibility score for a source"""
        score = 0.5  # Base score
        
        # Domain reputation
        domain = urlparse(source_data['url']).netloc.lower()
        trusted_domains = [
            'wikipedia.org', 'nature.com', 'science.org', 'arxiv.org',
            'pubmed.ncbi.nlm.nih.gov', 'bbc.com', 'reuters.com', 'nytimes.com'
        ]
        
        if any(d in domain for d in trusted_domains):
            score += 0.3
        
        # Has authors
        if source_data.get('authors') and len(source_data['authors']) > 0:
            score += 0.1
        
        # Has publication date
        if source_data.get('publication_date'):
            score += 0.05
        
        # Content length (substantial content)
        content_length = len(source_data.get('content', ''))
        if content_length > 1000:
            score += 0.05
        
        # Source type bonus
        if source_data.get('source_type') == 'academic':
            score += 0.2
        elif source_data.get('source_type') == 'news':
            score += 0.1
        
        return min(score, 1.0)  # Cap at 1.0
    
    def search_web(self, query: str, max_results: int = 10) -> List[str]:
        """Search the web for URLs related to a query"""
        # Note: In a real implementation, you would use a search API like:
        # - Google Custom Search API
        # - Bing Search API
        # - DuckDuckGo API
        # For now, we'll return a placeholder
        
        urls = []
        
        # Wikipedia search
        try:
            wiki_results = wikipedia.search(query, results=3)
            for result in wiki_results:
                try:
                    page = wikipedia.page(result)
                    urls.append(page.url)
                except:
                    pass
        except:
            pass
        
        # In production, add actual web search here
        # urls.extend(self._search_google(query, max_results - len(urls)))
        
        return urls[:max_results]
    
    def extract_citations(self, source_data: Dict) -> Dict[str, str]:
        """Extract citation information from source data"""
        url = source_data['url']
        title = source_data['title']
        authors = source_data.get('authors', [])
        pub_date = source_data.get('publication_date')
        
        # Format authors
        if authors:
            if len(authors) == 1:
                author_str = authors[0]
            elif len(authors) == 2:
                author_str = f"{authors[0]} and {authors[1]}"
            else:
                author_str = f"{authors[0]} et al."
        else:
            author_str = "Unknown Author"
        
        # Format date
        if pub_date:
            if isinstance(pub_date, str):
                year = pub_date[:4]
            else:
                year = pub_date.year
        else:
            year = datetime.now().year
        
        # APA format
        apa = f"{author_str} ({year}). {title}. Retrieved from {url}"
        
        # MLA format
        mla = f'{author_str}. "{title}." Web. {datetime.now().strftime("%d %b %Y")}.'
        
        # Chicago format
        chicago = f'{author_str}. "{title}." Accessed {datetime.now().strftime("%B %d, %Y")}. {url}.'
        
        # BibTeX
        bibtex = f"""@misc{{
    author = {{{author_str}}},
    title = {{{title}}},
    year = {{{year}}},
    url = {{{url}}},
    urldate = {{{datetime.now().strftime("%Y-%m-%d")}}}
}}"""
        
        return {
            'apa': apa,
            'mla': mla,
            'chicago': chicago,
            'bibtex': bibtex
        }