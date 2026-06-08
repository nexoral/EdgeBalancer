import { render, screen, fireEvent } from '@testing-library/react';
import { Modal, ConfirmModal } from '@/components/ui/Modal';

describe('Modal', () => {
  it('renders title and children when open', () => {
    render(
      <Modal isOpen title="Delete Balancer" onClose={jest.fn()}>
        Are you sure?
      </Modal>
    );
    expect(screen.getByText('Delete Balancer')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(
      <Modal isOpen={false} title="Hidden" onClose={jest.fn()}>
        Hidden content
      </Modal>
    );
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(
      <Modal isOpen title="Test" onClose={onClose}>
        Body
      </Modal>
    );
    // The close button has an X icon — find the button by its role
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders footer when provided', () => {
    render(
      <Modal isOpen title="Test" onClose={jest.fn()} footer={<button>Save</button>}>
        Body
      </Modal>
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
});

describe('ConfirmModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    title: 'Confirm Delete',
    message: 'This action cannot be undone.',
  };

  it('renders title and message', () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = jest.fn();
    render(<ConfirmModal {...defaultProps} onConfirm={onConfirm} confirmText="Delete" />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel/onClose when cancel button is clicked', () => {
    const onClose = jest.fn();
    render(<ConfirmModal {...defaultProps} onClose={onClose} cancelText="Cancel" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows processing text and disables action buttons when loading', () => {
    render(<ConfirmModal {...defaultProps} confirmText="Delete" cancelText="Cancel" loading />);
    expect(screen.getByText(/Processing/)).toBeInTheDocument();
    // The Cancel and Confirm action buttons should be disabled
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Processing/ })).toBeDisabled();
  });
});
