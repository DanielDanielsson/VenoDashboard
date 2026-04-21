// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import RootLayout from '@/app/layout';

describe('RootLayout', () => {
  test('wraps the app with the shared notifications viewport', () => {
    const markup = renderToStaticMarkup(
      RootLayout({
        children: React.createElement('div', null, 'Dashboard child'),
      }),
    );

    expect(markup).toContain('Dashboard child');
    expect(markup).toContain('aria-label="Notifications"');
  });
});
