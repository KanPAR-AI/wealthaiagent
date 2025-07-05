import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PromptInputWithActions } from '../chat-input';
import { createMockFile } from '@/test/utils';

describe('PromptInputWithActions', () => {
  const mockOnSubmit = jest.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TC_007: Single Image Upload', () => {
    it('should successfully upload a single image file', async () => {
      render(<PromptInputWithActions onSubmit={mockOnSubmit} />);

      const fileInput = screen.getByTestId('file-upload') || document.getElementById('file-upload');
      const imageFile = createMockFile('test-image.jpg', 'image/jpeg');

      if (fileInput) {
        await user.upload(fileInput as HTMLInputElement, imageFile);
      }

      // Verify file preview is shown
      expect(screen.getByText('test-image.jpg')).toBeInTheDocument();
      
      // Submit the message - find the button with arrow-up icon
      const sendButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('.lucide-arrow-up')
      );
      if (sendButton) {
        await user.click(sendButton);
      }

      // Verify file is sent with submission
      expect(mockOnSubmit).toHaveBeenCalledWith('', [imageFile]);
    });

    it('should show preview for PNG images', async () => {
      render(<PromptInputWithActions onSubmit={mockOnSubmit} />);

      const fileInput = document.getElementById('file-upload');
      const pngFile = createMockFile('test.png', 'image/png');

      if (fileInput) {
        await user.upload(fileInput as HTMLInputElement, pngFile);
      }

      expect(screen.getByText('test.png')).toBeInTheDocument();
    });
  });

  describe('TC_008: Multiple Image Upload', () => {
    it('should upload multiple image files simultaneously', async () => {
      render(<PromptInputWithActions onSubmit={mockOnSubmit} />);

      const fileInput = document.getElementById('file-upload');
      const files = [
        createMockFile('image1.jpg', 'image/jpeg'),
        createMockFile('image2.png', 'image/png'),
        createMockFile('image3.gif', 'image/gif')
      ];

      if (fileInput) {
        await user.upload(fileInput as HTMLInputElement, files);
      }

      // Verify all files show previews
      expect(screen.getByText('image1.jpg')).toBeInTheDocument();
      expect(screen.getByText('image2.png')).toBeInTheDocument();
      expect(screen.getByText('image3.gif')).toBeInTheDocument();

      // Submit and verify all files are sent
      const sendButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('.lucide-arrow-up')
      );
      if (sendButton) {
        await user.click(sendButton);
      }

      expect(mockOnSubmit).toHaveBeenCalledWith('', files);
    });
  });

  describe('TC_009: Mixed File Types Upload', () => {
    it('should upload multiple files of different types', async () => {
      render(<PromptInputWithActions onSubmit={mockOnSubmit} />);

      const fileInput = document.getElementById('file-upload');
      const mixedFiles = [
        createMockFile('document.pdf', 'application/pdf'),
        createMockFile('photo.jpg', 'image/jpeg'),
        createMockFile('image.png', 'image/png'),
        createMockFile('spreadsheet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      ];

      if (fileInput) {
        await user.upload(fileInput as HTMLInputElement, mixedFiles);
      }

      // Verify all file types are displayed
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
      expect(screen.getByText('photo.jpg')).toBeInTheDocument();
      expect(screen.getByText('image.png')).toBeInTheDocument();
      expect(screen.getByText('spreadsheet.xlsx')).toBeInTheDocument();

      const sendButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('.lucide-arrow-up')
      );
      if (sendButton) {
        await user.click(sendButton);
      }

      expect(mockOnSubmit).toHaveBeenCalledWith('', mixedFiles);
    });
  });

  describe('TC_010: File Preview Display', () => {
    it('should display file previews before sending', async () => {
      render(<PromptInputWithActions onSubmit={mockOnSubmit} />);

      const fileInput = document.getElementById('file-upload');
      const files = [
        createMockFile('preview.jpg', 'image/jpeg'),
        createMockFile('document.pdf', 'application/pdf')
      ];

      if (fileInput) {
        await user.upload(fileInput as HTMLInputElement, files);
      }

      // Verify file names are displayed
      expect(screen.getByText('preview.jpg')).toBeInTheDocument();
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
    });

    it('should allow removing files from preview', async () => {
      render(<PromptInputWithActions onSubmit={mockOnSubmit} />);

      const fileInput = document.getElementById('file-upload');
      const file = createMockFile('removable.jpg', 'image/jpeg');

      if (fileInput) {
        await user.upload(fileInput as HTMLInputElement, file);
      }
      
      expect(screen.getByText('removable.jpg')).toBeInTheDocument();

      // Remove the file - find the X button
      const removeButton = screen.getAllByRole('button').find(btn => 
        btn.getAttribute('aria-label')?.includes('Remove')
      );
      if (removeButton) {
        await user.click(removeButton);
      }

      expect(screen.queryByText('removable.jpg')).not.toBeInTheDocument();
    });
  });

  describe('TC_014: Optimistic UI - Instant File Display', () => {
    it('should display files immediately after sending', async () => {
      render(<PromptInputWithActions onSubmit={mockOnSubmit} />);

      const fileInput = document.getElementById('file-upload');
      const file = createMockFile('instant.jpg', 'image/jpeg');

      if (fileInput) {
        await user.upload(fileInput as HTMLInputElement, file);
      }
      
      // Type a message
      const textarea = screen.getByPlaceholderText('Ask me anything...');
      await user.type(textarea, 'Check this image');

      // Send message
      const sendButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('.lucide-arrow-up')
      );
      if (sendButton) {
        await user.click(sendButton);
      }

      // Verify immediate submission
      expect(mockOnSubmit).toHaveBeenCalledWith('Check this image', [file]);

      // After submission, input should be cleared
      expect(textarea).toHaveValue('');
      expect(screen.queryByText('instant.jpg')).not.toBeInTheDocument();
    });
  });

  describe('TC_017: Loading State Visibility', () => {
    it('should show loading state during file upload', async () => {
      render(<PromptInputWithActions onSubmit={mockOnSubmit} isLoading={true} />);

      // Check that input is disabled during loading
      const textarea = screen.getByPlaceholderText('Ask me anything...');
      expect(textarea).toBeDisabled();

      // Check that file input is disabled
      const fileInput = document.getElementById('file-upload');
      expect(fileInput).toBeDisabled();

      // Check that send button shows loading state (square icon)
      const loadingButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('.lucide-square')
      );
      expect(loadingButton).toBeInTheDocument();
    });
  });

  describe('Text Input Functionality', () => {
    it('should handle text input and submission', async () => {
      render(<PromptInputWithActions onSubmit={mockOnSubmit} />);

      const textarea = screen.getByPlaceholderText('Ask me anything...');
      await user.type(textarea, 'Hello, AI!');

      expect(textarea).toHaveValue('Hello, AI!');

      // Submit with Enter key
      await user.keyboard('{Enter}');

      expect(mockOnSubmit).toHaveBeenCalledWith('Hello, AI!', []);
    });

    it('should allow multiline input with Shift+Enter', async () => {
      render(<PromptInputWithActions onSubmit={mockOnSubmit} />);

      const textarea = screen.getByPlaceholderText('Ask me anything...');
      await user.type(textarea, 'Line 1{Shift>}{Enter}{/Shift}Line 2');

      expect(textarea).toHaveValue('Line 1\nLine 2');

      // Regular Enter should still submit
      await user.keyboard('{Enter}');

      expect(mockOnSubmit).toHaveBeenCalledWith('Line 1\nLine 2', []);
    });

    it('should not submit empty messages without files', async () => {
      render(<PromptInputWithActions onSubmit={mockOnSubmit} />);

      const sendButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('.lucide-arrow-up')
      );
      if (sendButton) {
        await user.click(sendButton);
      }

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should submit with only files (no text)', async () => {
      render(<PromptInputWithActions onSubmit={mockOnSubmit} />);

      const fileInput = document.getElementById('file-upload');
      const file = createMockFile('only-file.jpg', 'image/jpeg');

      if (fileInput) {
        await user.upload(fileInput as HTMLInputElement, file);
      }

      const sendButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('.lucide-arrow-up')
      );
      if (sendButton) {
        await user.click(sendButton);
      }

      expect(mockOnSubmit).toHaveBeenCalledWith('', [file]);
    });
  });

  describe('Voice Input', () => {
    it('should toggle voice recording', async () => {
      render(<PromptInputWithActions onSubmit={mockOnSubmit} />);

      const voiceButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('.lucide-mic')
      );
      
      // Mock getUserMedia
      const mockGetUserMedia = jest.fn().mockResolvedValue({
        getTracks: () => [{ stop: jest.fn() }]
      });
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        value: mockGetUserMedia,
        writable: true
      });

      if (voiceButton) {
        await user.click(voiceButton);
      }

      // Should show stop recording button
      await waitFor(() => {
        const stopButton = screen.getAllByRole('button').find(btn => 
          btn.querySelector('.lucide-mic-off')
        );
        expect(stopButton).toBeInTheDocument();
      });
    });
  });
}); 