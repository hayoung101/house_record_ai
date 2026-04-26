import { useRef, useState, useCallback } from 'react';
import { Upload } from 'lucide-react';

interface ImageUploadProps {
  onImageSelect: (file: File) => void;
  disabled?: boolean;
}

export default function ImageUpload({ onImageSelect, disabled }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    onImageSelect(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  return (
    <div
      className={`image-upload${isDragging ? ' dragging' : ''}${disabled ? ' disabled' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragging(false)}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        disabled={disabled}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      {preview ? (
        <img src={preview} alt="업로드된 이미지" className="image-upload-preview" />
      ) : (
        <div className="image-upload-placeholder">
          <Upload size={40} color="#94a3b8" />
          <p>이미지를 드래그하거나 클릭하여 업로드</p>
          <span>JPG, PNG, WEBP 지원</span>
        </div>
      )}
    </div>
  );
}
