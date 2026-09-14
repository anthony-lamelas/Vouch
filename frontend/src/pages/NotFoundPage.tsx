import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';

export function NotFoundPage() {
  return (
    <div className="pt-4">
      <EmptyState>
        There is nothing at this address.{' '}
        <Link to="/roles" className="link">
          Go to roles
        </Link>
      </EmptyState>
    </div>
  );
}
