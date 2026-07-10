"""
Lightweight version of image comparison service for testing without heavy ML dependencies
"""
import os
import hashlib
import numpy as np
from PIL import Image
from typing import List, Dict, Tuple
import logging
from dataclasses import dataclass
from enum import Enum
import imagehash

logger = logging.getLogger(__name__)


class ComparisonType(Enum):
    IDENTICAL = "identical"
    SIMILAR = "similar"


@dataclass
class ComparisonResult:
    source_image: str
    target_image: str
    similarity_score: float
    comparison_type: ComparisonType
    metadata: Dict


class ImageComparisonServiceLite:
    """Lightweight service for comparing JPEG/PNG images without heavy ML dependencies"""
    
    def compute_file_hash(self, image_path: str) -> str:
        """Compute SHA256 hash of image file for identical matching"""
        sha256_hash = hashlib.sha256()
        with open(image_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    
    def compute_perceptual_hash(self, image_path: str) -> str:
        """Compute perceptual hash for near-identical matching"""
        img = Image.open(image_path)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        return str(imagehash.phash(img))
    
    def compute_color_histogram(self, image_path: str) -> np.ndarray:
        """Compute color histogram for color-based similarity"""
        img = Image.open(image_path)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Convert to numpy array
        img_array = np.array(img)
        
        # Calculate histograms for each channel
        hist_r = np.histogram(img_array[:,:,0], bins=64, range=(0, 256))[0]
        hist_g = np.histogram(img_array[:,:,1], bins=64, range=(0, 256))[0]
        hist_b = np.histogram(img_array[:,:,2], bins=64, range=(0, 256))[0]
        
        # Normalize and concatenate
        hist = np.concatenate([hist_r, hist_g, hist_b]).astype(float)
        if np.sum(hist) > 0:
            hist = hist / np.sum(hist)
        
        return hist
    
    def compute_simple_features(self, image_path: str) -> Dict:
        """Extract simple image features"""
        img = Image.open(image_path)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        img_array = np.array(img)
        
        # Simple features
        features = {
            'width': img.width,
            'height': img.height,
            'aspect_ratio': img.width / img.height if img.height > 0 else 0,
            'mean_color': img_array.mean(axis=(0, 1)).tolist(),
            'std_color': img_array.std(axis=(0, 1)).tolist(),
        }
        
        return features
    
    def histogram_similarity(self, hist1: np.ndarray, hist2: np.ndarray) -> float:
        """Calculate histogram similarity using correlation"""
        # Ensure same size
        min_len = min(len(hist1), len(hist2))
        hist1 = hist1[:min_len]
        hist2 = hist2[:min_len]
        
        # Calculate correlation coefficient
        if np.std(hist1) == 0 or np.std(hist2) == 0:
            return 0.0
        
        correlation = np.corrcoef(hist1, hist2)[0, 1]
        # Convert to 0-1 range
        return max(0, correlation)
    
    def find_identical_matches(self, folder_a: List[str], folder_b: List[str]) -> List[ComparisonResult]:
        """Find identical image matches between two folders"""
        results = []
        
        # Compute hashes for all images
        hashes_a = {img: self.compute_file_hash(img) for img in folder_a}
        hashes_b = {img: self.compute_file_hash(img) for img in folder_b}
        
        # Find identical matches
        for img_a, hash_a in hashes_a.items():
            for img_b, hash_b in hashes_b.items():
                if hash_a == hash_b:
                    results.append(ComparisonResult(
                        source_image=img_a,
                        target_image=img_b,
                        similarity_score=1.0,
                        comparison_type=ComparisonType.IDENTICAL,
                        metadata={'hash': hash_a}
                    ))
        
        # Check for perceptually identical images
        for img_a in folder_a:
            try:
                phash_a = self.compute_perceptual_hash(img_a)
                for img_b in folder_b:
                    phash_b = self.compute_perceptual_hash(img_b)
                    
                    # Calculate hamming distance
                    distance = sum(c1 != c2 for c1, c2 in zip(phash_a, phash_b))
                    similarity = 1 - (distance / len(phash_a))
                    
                    if similarity > 0.95 and not any(
                        r.source_image == img_a and r.target_image == img_b 
                        for r in results
                    ):
                        results.append(ComparisonResult(
                            source_image=img_a,
                            target_image=img_b,
                            similarity_score=similarity,
                            comparison_type=ComparisonType.IDENTICAL,
                            metadata={'perceptual_similarity': similarity}
                        ))
            except Exception as e:
                logger.warning(f"Error computing perceptual hash: {e}")
        
        return results
    
    def find_similar_matches(self, folder_a: List[str], folder_c: List[str], 
                           similarity_threshold: float = 0.7) -> List[ComparisonResult]:
        """Find similar images based on simple features and color histograms"""
        results = []
        
        for img_a in folder_a:
            try:
                # Extract features for image A
                hist_a = self.compute_color_histogram(img_a)
                features_a = self.compute_simple_features(img_a)
                phash_a = self.compute_perceptual_hash(img_a)
                
                for img_c in folder_c:
                    # Extract features for image C
                    hist_c = self.compute_color_histogram(img_c)
                    features_c = self.compute_simple_features(img_c)
                    phash_c = self.compute_perceptual_hash(img_c)
                    
                    # Calculate similarity scores
                    color_similarity = self.histogram_similarity(hist_a, hist_c)
                    
                    # Aspect ratio similarity
                    aspect_similarity = 1 - abs(features_a['aspect_ratio'] - features_c['aspect_ratio']) / max(
                        features_a['aspect_ratio'], features_c['aspect_ratio'], 0.001
                    )
                    
                    # Perceptual hash similarity
                    distance = sum(c1 != c2 for c1, c2 in zip(phash_a, phash_c))
                    phash_similarity = 1 - (distance / len(phash_a))
                    
                    # Weighted average
                    total_similarity = (
                        0.4 * color_similarity +
                        0.3 * phash_similarity +
                        0.3 * aspect_similarity
                    )
                    
                    if total_similarity >= similarity_threshold:
                        results.append(ComparisonResult(
                            source_image=img_a,
                            target_image=img_c,
                            similarity_score=total_similarity,
                            comparison_type=ComparisonType.SIMILAR,
                            metadata={
                                'color_similarity': float(color_similarity),
                                'perceptual_similarity': float(phash_similarity),
                                'aspect_similarity': float(aspect_similarity)
                            }
                        ))
            except Exception as e:
                logger.warning(f"Error comparing images: {e}")
        
        # Sort by similarity score
        results.sort(key=lambda x: x.similarity_score, reverse=True)
        return results
    
    def compare_images(self, folder_a_paths: List[str], folder_b_paths: List[str], 
                       folder_c_paths: List[str]) -> Dict:
        """Main method to perform complete image comparison"""
        try:
            # Find identical matches between Folder A and Folder B
            identical_matches = self.find_identical_matches(folder_a_paths, folder_b_paths)
            
            # Find similar matches between Folder A and Folder C
            similar_matches = self.find_similar_matches(folder_a_paths, folder_c_paths)
            
            return {
                'success': True,
                'identical_matches': [
                    {
                        'source': os.path.basename(r.source_image),
                        'target': os.path.basename(r.target_image),
                        'score': r.similarity_score,
                        'metadata': r.metadata
                    }
                    for r in identical_matches
                ],
                'similar_matches': [
                    {
                        'source': os.path.basename(r.source_image),
                        'target': os.path.basename(r.target_image),
                        'score': r.similarity_score,
                        'metadata': r.metadata
                    }
                    for r in similar_matches
                ],
                'statistics': {
                    'total_identical': len(identical_matches),
                    'total_similar': len(similar_matches),
                    'images_in_folder_a': len(folder_a_paths),
                    'images_in_folder_b': len(folder_b_paths),
                    'images_in_folder_c': len(folder_c_paths)
                }
            }
        except Exception as e:
            logger.error(f"Image comparison error: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }