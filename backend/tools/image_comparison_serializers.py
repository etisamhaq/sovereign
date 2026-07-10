from rest_framework import serializers
from django.core.validators import FileExtensionValidator


class ImageUploadSerializer(serializers.Serializer):
    """Serializer for uploading images to folders"""
    folder_a = serializers.ListField(
        child=serializers.ImageField(
            validators=[FileExtensionValidator(allowed_extensions=['jpg', 'jpeg', 'png'])],
            max_length=None,
            allow_empty_file=False,
            use_url=False
        ),
        required=True,
        allow_empty=False,
        help_text="JPEG/PNG images for Folder A (source images)"
    )
    
    folder_b = serializers.ListField(
        child=serializers.ImageField(
            validators=[FileExtensionValidator(allowed_extensions=['jpg', 'jpeg', 'png'])],
            max_length=None,
            allow_empty_file=False,
            use_url=False
        ),
        required=True,
        allow_empty=False,
        help_text="JPEG/PNG images for Folder B (for identical matching)"
    )
    
    folder_c = serializers.ListField(
        child=serializers.ImageField(
            validators=[FileExtensionValidator(allowed_extensions=['jpg', 'jpeg', 'png'])],
            max_length=None,
            allow_empty_file=False,
            use_url=False
        ),
        required=True,
        allow_empty=False,
        help_text="JPEG/PNG images for Folder C (for similarity matching)"
    )
    
    similarity_threshold = serializers.FloatField(
        default=0.7,
        min_value=0.0,
        max_value=1.0,
        help_text="Similarity threshold for finding similar images (0-1)"
    )
    
    def validate(self, data):
        """Validate uploaded images"""
        if len(data['folder_a']) > 50:
            raise serializers.ValidationError("Folder A can contain maximum 50 images")
        if len(data['folder_b']) > 50:
            raise serializers.ValidationError("Folder B can contain maximum 50 images")
        if len(data['folder_c']) > 50:
            raise serializers.ValidationError("Folder C can contain maximum 50 images")
        
        # Validate file sizes
        max_size = 10 * 1024 * 1024  # 10MB
        for folder_name, folder_images in [('folder_a', data['folder_a']), 
                                           ('folder_b', data['folder_b']), 
                                           ('folder_c', data['folder_c'])]:
            for img in folder_images:
                if img.size > max_size:
                    raise serializers.ValidationError(
                        f"Image {img.name} in {folder_name} exceeds maximum size of 10MB"
                    )
        
        return data


class ImageComparisonResultSerializer(serializers.Serializer):
    """Serializer for image comparison results"""
    source = serializers.CharField(help_text="Source image filename")
    target = serializers.CharField(help_text="Target image filename")
    score = serializers.FloatField(help_text="Similarity score (0-1)")
    metadata = serializers.DictField(help_text="Additional comparison metadata")


class ImageComparisonResponseSerializer(serializers.Serializer):
    """Serializer for the complete comparison response"""
    success = serializers.BooleanField()
    identical_matches = ImageComparisonResultSerializer(many=True, required=False)
    similar_matches = ImageComparisonResultSerializer(many=True, required=False)
    statistics = serializers.DictField(required=False)
    error = serializers.CharField(required=False)