import HrvReader from './HrvReader';
import { saveDefaultHrvSource } from '@/lib/hrv/adapterRegistry';

// Reusable deployment/setup surface. It exercises the same selector, adapter,
// validation, and capture path the cards use; a source becomes default only after
// a valid reading completes.
export default function HrvSourceSetup({ onVerified }) {
  return (
    <HrvReader
      persistOnSelect={false}
      successLabel="Source verified"
      onReading={async reading => {
        saveDefaultHrvSource(reading.source);
        await onVerified?.(reading);
      }}
    />
  );
}
