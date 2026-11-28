import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import App from '../src/App';

function json(data: unknown, status=200) {
  return new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json'}});
}

function stubApi() {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url=String(input);
    if(url.includes('/api/location')) return json({latitude:18.52,longitude:73.85,city:'Pune',country:'India'});
    if(url.includes('/api/air')) return json({source:'live',city:'Pune, India',aqi:86,pm25:24,pm10:37,temperature:29,humidity:48,wind:9,updated:'2026-11-28T10:00',forecast:[{time:'11:00',value:82}]});
    if(url.includes('/api/assistant')) return json({mode:'rule-based',question:'Should my child play outside?',summary:'US AQI is 86.',action:'Check again before longer activity.',reason:'Air conditions can change.',benefit:'Keeps plans responsive.',impact:null,confidence:'Moderate.',alternative:'Choose a shorter indoor activity.'});
    throw new Error(`Unexpected request: ${url}`);
  }));
}

describe('AirAware application', () => {
  beforeEach(() => { stubApi(); vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
  afterEach(() => cleanup());

  it('renders measured air data from the API instead of sample readings', async () => {
    render(<App/>);
    expect(await screen.findByText('Moderate')).toBeInTheDocument();
    expect(screen.getByText('86')).toBeInTheDocument();
    expect(screen.getByText('LIVE DATA')).toBeInTheDocument();
    expect(screen.getByText('Pune, India')).toBeInTheDocument();
  });

  it('persists household switches locally and exposes their state to assistive tech', async () => {
    const user=userEvent.setup();
    render(<App/>);
    await user.click(screen.getByRole('button',{name:'Family Profile'}));
    const children=screen.getByRole('switch',{name:'Children in household'});
    expect(children).toHaveAttribute('aria-checked','true');
    await user.click(children);
    expect(children).toHaveAttribute('aria-checked','false');
    await waitFor(()=>expect(JSON.parse(localStorage.getItem('airaware-profile')||'{}').children).toBe(false));
  });

  it('submits an assistant question and displays the structured response', async () => {
    const user=userEvent.setup();
    render(<App/>);
    await user.click(screen.getByRole('button',{name:/AI Air Assistant/}));
    await user.type(screen.getByRole('textbox',{name:'Ask AirAware'}),'Should my child play outside?');
    await user.click(screen.getByRole('button',{name:/Ask/}));
    expect(await screen.findByText('US AQI is 86.')).toBeInTheDocument();
    expect(screen.getByText('RULE-BASED GUIDANCE')).toBeInTheDocument();
  });

  it('has no critical or serious axe accessibility violations on the overview', async () => {
    const {container}=render(<App/>);
    await screen.findByText('Moderate');
    // jsdom cannot calculate rendered contrast; contrast is checked separately from the CSS palette.
    const result=await axe.run(container,{rules:{'color-contrast':{enabled:false}}});
    const serious=result.violations.filter(issue=>issue.impact==='critical'||issue.impact==='serious');
    expect(serious.map(issue=>({id:issue.id,help:issue.help,nodes:issue.nodes.length}))).toEqual([]);
  });
});
