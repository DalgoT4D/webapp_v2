import { PipelineOverview } from '@/components/pipeline/pipeline-overview';

export default function PipelineOverviewPage() {
  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0 border-b bg-background">
        <div className="flex items-center justify-between mb-6 p-6 pb-0">
          <div>
            <h1 className="text-3xl font-bold">Pipeline Overview</h1>
            <p className="text-muted-foreground mt-1">Monitor And Track Your Pipeline Runs</p>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <PipelineOverview />
      </div>
    </div>
  );
}
