import { parseCommentDeepLink } from '@/components/reports/logic/comment-deep-link';

const parse = (query: string) => parseCommentDeepLink(new URLSearchParams(query));

describe('parseCommentDeepLink', () => {
  it('no params: nothing opens', () => {
    expect(parse('')).toEqual({ autoOpenSummary: false, autoOpenChartId: undefined });
  });

  it('?commentTarget=summary opens the summary thread', () => {
    expect(parse('commentTarget=summary')).toEqual({
      autoOpenSummary: true,
      autoOpenChartId: undefined,
    });
  });

  it('?commentTarget=chart&chartId=12 opens that chart thread (id stays a string)', () => {
    expect(parse('commentTarget=chart&chartId=12')).toEqual({
      autoOpenSummary: false,
      autoOpenChartId: '12',
    });
  });

  it('chart target without chartId opens nothing', () => {
    expect(parse('commentTarget=chart').autoOpenChartId).toBeUndefined();
  });

  it('?commentTarget=kpi is ignored (pinned: KPI email deep links do not open)', () => {
    expect(parse('commentTarget=kpi&chartId=42')).toEqual({
      autoOpenSummary: false,
      autoOpenChartId: undefined,
    });
  });
});
