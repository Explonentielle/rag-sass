'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import OnboardingTour, { type OnboardingChatbot } from '@/components/OnboardingTour';

export default function ReplayOnboardingButton({
  organizationId,
  existingChatbots,
}: {
  organizationId: string;
  existingChatbots: OnboardingChatbot[];
}) {
  const [show, setShow] = useState(false);

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setShow(true)}>
        Revoir la présentation
      </Button>
      {show && (
        <OnboardingTour
          organizationId={organizationId}
          existingChatbots={existingChatbots}
          onClose={() => setShow(false)}
        />
      )}
    </>
  );
}
