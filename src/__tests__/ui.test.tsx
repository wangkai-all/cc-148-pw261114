import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { createMockAppState } from './helpers';

describe('页面交互', () => {
  it('默认展示容量网格与汇总', async () => {
    render(<App initial={createMockAppState()} />);
    expect(await screen.findByText('可售日历')).toBeInTheDocument();
    expect(screen.getByLabelText('观察时点')).toBeInTheDocument();
  });

  it('打开一晚查看占用明细, 并可按住宿日核对', async () => {
    const user = userEvent.setup();
    render(<App initial={createMockAppState()} />);
    const cells = await screen.findAllByRole('button', { name: /标准大床房 11月13日/ });
    await user.click(cells[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: /11月13日/ })).toBeInTheDocument();
    expect(within(dialog).getByText('R-1001')).toBeInTheDocument();
    expect(within(dialog).getAllByText(/2026-11-13 → 2026-11-17（退房日不计）/).length).toBeGreaterThan(0);
    await user.click(within(dialog).getByRole('button', { name: /关闭/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
