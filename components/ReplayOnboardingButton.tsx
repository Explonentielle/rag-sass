'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import OnboardingTour from '@/components/OnboardingTour';

export default function ReplayOnboardingButton() {
  const [show, setShow] = useState(false);

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setShow(true)}>
        Revoir la présentation
      </Button>
      {show && <OnboardingTour onClose={() => setShow(false)} />}
    </>
  );
}
