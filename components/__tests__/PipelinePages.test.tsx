import React from 'react';
import { render, screen } from '@testing-library/react';
import Ingest from '../ingest';
import Transform from '../transform';
import Orchestrate from '../orchestrate';
import PipelineOverview from '../pipeline-overview';

// Mock SharedIframe to capture props passed to it
jest.mock('../shared-iframe', () => {
  return function MockSharedIframe({ src, title }: { src: string; title: string }) {
    return <div data-testid="shared-iframe" data-src={src} data-title={title} />;
  };
});

// Mock the embedded app URL constant
jest.mock('@/constants/constants', () => ({
  embeddedAppUrl: 'https://embedded.example.com',
}));

describe('Pipeline Page Components', () => {
  describe('Ingest', () => {
    it('passes correct URL to SharedIframe', () => {
      render(<Ingest />);
      const iframe = screen.getByTestId('shared-iframe');
      expect(iframe.getAttribute('data-src')).toBe(
        'https://embedded.example.com/pipeline/ingest?tab=connections&fullwidth=true'
      );
      expect(iframe.getAttribute('data-title')).toBe('Data Ingestion Pipeline');
    });
  });

  describe('Transform', () => {
    it('passes correct URL to SharedIframe', () => {
      render(<Transform />);
      const iframe = screen.getByTestId('shared-iframe');
      expect(iframe.getAttribute('data-src')).toBe(
        'https://embedded.example.com/pipeline/transform'
      );
      expect(iframe.getAttribute('data-title')).toBe('Data Transformation');
    });
  });

  describe('Orchestrate', () => {
    it('passes correct URL to SharedIframe', () => {
      render(<Orchestrate />);
      const iframe = screen.getByTestId('shared-iframe');
      expect(iframe.getAttribute('data-src')).toBe(
        'https://embedded.example.com/pipeline/orchestrate'
      );
      expect(iframe.getAttribute('data-title')).toBe('Data Orchestration');
    });
  });

  describe('PipelineOverview', () => {
    it('passes correct URL to SharedIframe', () => {
      render(<PipelineOverview />);
      const iframe = screen.getByTestId('shared-iframe');
      expect(iframe.getAttribute('data-src')).toBe('https://embedded.example.com/pipeline');
      expect(iframe.getAttribute('data-title')).toBe('Data Orchestration');
    });
  });
});
