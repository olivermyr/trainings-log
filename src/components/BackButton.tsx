import { useNavigate } from 'react-router-dom';
import { IconChevronLeft } from './Icons';

export function BackButton({ label }: { label: string }) {
  const navigate = useNavigate();
  return (
    <button className="back" onClick={() => navigate(-1)}>
      <IconChevronLeft /> {label}
    </button>
  );
}
