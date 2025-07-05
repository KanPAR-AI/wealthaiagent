import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilePreviewModal } from '../file-preview-modal';
import { MessageFile } from '@/types/chat';

describe('FilePreviewModal', () => {
  const user = userEvent.setup();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TC_019: Full Screen Preview - Images', () => {
    const imageFile: MessageFile = {
      name: 'test-image.jpg',
      type: 'image/jpeg',
      size: 1024,
      url: 'https://example.com/test-image.jpg'
    };

    it('should display full screen image preview when clicked', () => {
      render(
        <FilePreviewModal
          isOpen={true}
          onClose={mockOnClose}
          file={imageFile}
        />
      );

      // Verify image is displayed
      const image = screen.getByRole('img', { name: 'test-image.jpg' });
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', imageFile.url);
    });

    it('should close preview with X button', async () => {
      render(
        <FilePreviewModal
          isOpen={true}
          onClose={mockOnClose}
          file={imageFile}
        />
      );

      const closeButton = screen.getByLabelText('Close file preview');
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should close preview when clicking outside', async () => {
      const user = userEvent.setup();
      const mockOnClose = jest.fn();
      const file: MessageFile = {
        name: 'test-image.jpg',
        type: 'image/jpeg',
        size: 1024,
        url: 'https://example.com/test-image.jpg'
      };

      render(
        <FilePreviewModal
          file={file}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Click on the backdrop (the outer div with bg-black/80)
      const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/80');
      if (backdrop) {
        await user.click(backdrop);
      }

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should handle different image formats', () => {
      const pngFile: MessageFile = {
        name: 'test.png',
        type: 'image/png',
        size: 1024,
        url: 'https://example.com/test.png'
      };

      const { rerender } = render(
        <FilePreviewModal
          isOpen={true}
          onClose={mockOnClose}
          file={pngFile}
        />
      );

      expect(screen.getByRole('img')).toHaveAttribute('src', pngFile.url);

      // Test GIF
      const gifFile: MessageFile = {
        name: 'animated.gif',
        type: 'image/gif',
        size: 4096,
        url: 'https://example.com/animated.gif'
      };

      rerender(
        <FilePreviewModal
          isOpen={true}
          onClose={mockOnClose}
          file={gifFile}
        />
      );

      expect(screen.getByRole('img')).toHaveAttribute('src', gifFile.url);
    });
  });

  describe('TC_020: Full Screen Preview - PDF', () => {
    const pdfFile: MessageFile = {
      name: 'document.pdf',
      type: 'application/pdf',
      size: 10240,
      url: 'https://example.com/document.pdf'
    };

    it('should display full screen PDF preview when clicked', () => {
      render(
        <FilePreviewModal
          isOpen={true}
          onClose={mockOnClose}
          file={pdfFile}
        />
      );

      // Verify PDF viewer is displayed
      const iframe = screen.getByTitle('document.pdf');
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute('src', pdfFile.url);
    });

    it('should handle PDF navigation and zoom', () => {
      render(
        <FilePreviewModal
          isOpen={true}
          onClose={mockOnClose}
          file={pdfFile}
        />
      );

      const iframe = screen.getByTitle('document.pdf');
      expect(iframe.tagName).toBe('IFRAME');
      
      // PDF navigation and zoom would be handled by the browser's PDF viewer
      // We can verify the iframe is set up correctly
      expect(iframe).toHaveClass('w-full', 'h-full');
    });
  });

  describe('Other File Types', () => {
    it('should display Excel files with Office viewer', () => {
      const excelFile: MessageFile = {
        name: 'spreadsheet.xlsx',
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 5120,
        url: 'https://example.com/spreadsheet.xlsx'
      };

      render(
        <FilePreviewModal
          isOpen={true}
          onClose={mockOnClose}
          file={excelFile}
        />
      );

      const iframe = screen.getByTitle('spreadsheet.xlsx');
      expect(iframe).toHaveAttribute(
        'src',
        expect.stringContaining('view.officeapps.live.com')
      );
      expect(iframe).toHaveAttribute(
        'src',
        expect.stringContaining(encodeURIComponent(excelFile.url!))
      );
    });

    it('should show download link for unsupported file types', () => {
      const unsupportedFile: MessageFile = {
        name: 'archive.zip',
        type: 'application/zip',
        size: 20480,
        url: 'https://example.com/archive.zip'
      };

      render(
        <FilePreviewModal
          isOpen={true}
          onClose={mockOnClose}
          file={unsupportedFile}
        />
      );

      expect(screen.getByText('Preview not available for this file type.')).toBeInTheDocument();
      
      const downloadLink = screen.getByRole('link', { name: 'Download File' });
      expect(downloadLink).toHaveAttribute('href', unsupportedFile.url);
      expect(downloadLink).toHaveAttribute('download', unsupportedFile.name);
    });
  });

  describe('Modal Behavior', () => {
    it('should not render when isOpen is false', () => {
      render(
        <FilePreviewModal
          isOpen={false}
          onClose={mockOnClose}
          file={null}
        />
      );

      expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
    });

    it('should not render when file is null', () => {
      render(
        <FilePreviewModal
          isOpen={true}
          onClose={mockOnClose}
          file={null}
        />
      );

      expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
    });

    it('should prevent event propagation on content click', async () => {
      const imageFile: MessageFile = {
        name: 'test.jpg',
        type: 'image/jpeg',
        size: 1024,
        url: 'https://example.com/test.jpg'
      };

      render(
        <FilePreviewModal
          isOpen={true}
          onClose={mockOnClose}
          file={imageFile}
        />
      );

      // Click on the content (not backdrop)
      const content = screen.getByRole('img');
      await user.click(content);

      // Should not close
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });
}); 