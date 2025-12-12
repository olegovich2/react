import React from 'react';
import { UploadedImage } from '../../types/api.types';

interface ImageGalleryProps {
  images: UploadedImage[];
  onView: (imageId: number) => void;
  onDelete: (imageId: number) => void;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ images, onView, onDelete }) => {
  if (images.length === 0) {
    return <div>Нет загруженных изображений</div>;
  }

  return (
    <div data-div="allDownloadImages">
      {images.map((image) => (
        <div key={image.id} className="imageFromDB" data-div={image.id}>
          <div className="blockIMG">
            <img 
              className="smallImageUpload" 
              src={`data:image/png;base64,${image.smallImage}`} 
              alt={image.fileName} 
              data-img="fromDB"
            />
          </div>
          
          <div className="blockFileInfo">
            <p data-container="filename">{image.fileName}</p> {/* МЕНЯЕМ fileNameOriginIMG на fileName */}
            <p data-container="comment">{image.comment}</p>
          </div>
          
          <div className="blockButtons">
            <button 
              className="buttonFromTemplate" 
              type="button"
              data-container="lookButtonImages"
              data-id={image.id}
              onClick={() => onView(image.id)}
            >
              Посмотреть
            </button>
            
            <button 
              className="buttonFromTemplate" 
              type="button"
              data-container="deleteButtonImages"
              data-id={image.id}
              onClick={() => onDelete(image.id)}
            >
              Удалить
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ImageGallery;