import os
import hashlib
import numpy as np
from PIL import Image
import cv2
from typing import List, Dict, Tuple, Optional
import logging
from dataclasses import dataclass
from enum import Enum
import torch
import torchvision.models as models
import torchvision.transforms as transforms
from sklearn.metrics.pairwise import cosine_similarity
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


class ImageComparisonService:
    """Service for comparing JPEG/PNG images using various algorithms"""
    
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.feature_extractor = self._initialize_feature_extractor()
        self.transform = self._get_transform()
        
    def _initialize_feature_extractor(self):
        """Initialize pre-trained ResNet model for feature extraction"""
        model = models.resnet50(pretrained=True)
        model = torch.nn.Sequential(*list(model.children())[:-1])
        model.to(self.device)
        model.eval()
        return model
    
    def _get_transform(self):
        """Get image transformation pipeline"""
        return transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
    
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
    
    def extract_deep_features(self, image_path: str) -> np.ndarray:
        """Extract deep learning features using ResNet"""
        img = Image.open(image_path)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        img_tensor = self.transform(img).unsqueeze(0).to(self.device)
        
        with torch.no_grad():
            features = self.feature_extractor(img_tensor)
            features = features.cpu().numpy().flatten()
        
        return features
    
    def extract_geometric_features(self, image_path: str) -> Dict:
        """Extract geometric and shape features using OpenCV"""
        img = cv2.imread(image_path)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Extract SIFT features
        sift = cv2.SIFT_create()
        keypoints, descriptors = sift.detectAndCompute(gray, None)
        
        # Extract shape features
        edges = cv2.Canny(gray, 50, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Compute shape statistics
        shape_features = {
            'num_keypoints': len(keypoints),
            'num_contours': len(contours),
            'descriptors': descriptors if descriptors is not None else np.array([]),
            'aspect_ratio': img.shape[1] / img.shape[0],
            'edge_density': np.sum(edges > 0) / (edges.shape[0] * edges.shape[1])
        }
        
        return shape_features
    
    def compute_color_histogram(self, image_path: str) -> np.ndarray:
        """Compute color histogram for color-based similarity"""
        img = cv2.imread(image_path)
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Calculate histograms for each channel
        hist_r = cv2.calcHist([img_rgb], [0], None, [256], [0, 256])
        hist_g = cv2.calcHist([img_rgb], [1], None, [256], [0, 256])
        hist_b = cv2.calcHist([img_rgb], [2], None, [256], [0, 256])
        
        # Normalize and concatenate
        hist = np.concatenate([hist_r, hist_g, hist_b]).flatten()
        hist = hist / np.sum(hist)
        
        return hist
    
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
        
        # Check for perceptually identical images (same content, different compression)
        for img_a in folder_a:
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
        
        return results
    
    def find_similar_matches(self, folder_a: List[str], folder_c: List[str], 
                           similarity_threshold: float = 0.7) -> List[ComparisonResult]:
        """Find similar images based on shape, design, and geometric characteristics"""
        results = []
        
        for img_a in folder_a:
            # Extract multiple feature types
            deep_features_a = self.extract_deep_features(img_a)
            geo_features_a = self.extract_geometric_features(img_a)
            color_hist_a = self.compute_color_histogram(img_a)
            
            for img_c in folder_c:
                deep_features_c = self.extract_deep_features(img_c)
                geo_features_c = self.extract_geometric_features(img_c)
                color_hist_c = self.compute_color_histogram(img_c)
                
                # Calculate similarity scores
                deep_similarity = cosine_similarity(
                    deep_features_a.reshape(1, -1),
                    deep_features_c.reshape(1, -1)
                )[0, 0]
                
                color_similarity = 1 - cv2.compareHist(
                    color_hist_a.astype(np.float32),
                    color_hist_c.astype(np.float32),
                    cv2.HISTCMP_BHATTACHARYYA
                )
                
                # Geometric similarity based on keypoint matching
                geo_similarity = self._compute_geometric_similarity(
                    geo_features_a, geo_features_c
                )
                
                # Weighted average of similarities
                total_similarity = (
                    0.5 * deep_similarity +
                    0.3 * geo_similarity +
                    0.2 * color_similarity
                )
                
                if total_similarity >= similarity_threshold:
                    results.append(ComparisonResult(
                        source_image=img_a,
                        target_image=img_c,
                        similarity_score=total_similarity,
                        comparison_type=ComparisonType.SIMILAR,
                        metadata={
                            'deep_similarity': float(deep_similarity),
                            'geometric_similarity': float(geo_similarity),
                            'color_similarity': float(color_similarity)
                        }
                    ))
        
        # Sort by similarity score
        results.sort(key=lambda x: x.similarity_score, reverse=True)
        return results
    
    def _compute_geometric_similarity(self, features_a: Dict, features_c: Dict) -> float:
        """Compute geometric similarity between two sets of features"""
        # Compare aspect ratios
        aspect_similarity = 1 - abs(features_a['aspect_ratio'] - features_c['aspect_ratio']) / max(
            features_a['aspect_ratio'], features_c['aspect_ratio']
        )
        
        # Compare edge densities
        edge_similarity = 1 - abs(features_a['edge_density'] - features_c['edge_density'])
        
        # Compare SIFT descriptors if available
        sift_similarity = 0.5  # Default if no descriptors
        if features_a['descriptors'].size > 0 and features_c['descriptors'].size > 0:
            # Use FLANN matcher for SIFT features
            FLANN_INDEX_KDTREE = 1
            index_params = dict(algorithm=FLANN_INDEX_KDTREE, trees=5)
            search_params = dict(checks=50)
            
            flann = cv2.FlannBasedMatcher(index_params, search_params)
            matches = flann.knnMatch(
                features_a['descriptors'].astype(np.float32),
                features_c['descriptors'].astype(np.float32),
                k=2
            )
            
            # Apply Lowe's ratio test
            good_matches = []
            for match_pair in matches:
                if len(match_pair) == 2:
                    m, n = match_pair
                    if m.distance < 0.7 * n.distance:
                        good_matches.append(m)
            
            sift_similarity = len(good_matches) / max(
                features_a['num_keypoints'],
                features_c['num_keypoints']
            )
        
        # Weighted combination
        geometric_similarity = (
            0.3 * aspect_similarity +
            0.3 * edge_similarity +
            0.4 * sift_similarity
        )
        
        return geometric_similarity
    
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