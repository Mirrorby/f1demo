import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { start, stop, req, platform, db } from './harness.js';
before(start);
after(stop);

test('every niche exposes informational text without JavaScript in RU and EN previews', async () => {
  for (const theme of ['minimal', 'fashion', 'home', 'beauty']) {
    for (const lang of ['ru', 'en']) {
      const page = await req(`/templates/${theme}?lang=${lang}`);
      assert.equal(page.status, 200);
      for (const section of ['about', 'sizing', 'ordering', 'shipping', 'returns', 'faq'])
        assert.ok(page.body.includes(`id="store-${section}"`), theme + ' missing ' + section);
      assert.equal((page.body.match(/<details>/g) || []).length, 3);
      assert.match(page.body, /noindex, follow/);
      if (lang === 'en')
        assert.doesNotMatch(
          page.body.match(/<section id="store-faq"[\s\S]*?<\/section>/)[0],
          /[А-Яа-я]/,
        );
      const data = JSON.parse(
        page.body.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1],
      );
      assert.equal(data['@type'], 'Organization');
      assert.ok(data.name);
      assert.equal(data.review, undefined);
    }
  }
});

test('merchant information is persisted, escaped and removable, including FAQ pairs', async () => {
  const created = await platform('stores', 'POST', { name: 'Content test', templateId: 'home' });
  const cfg = (await req('/api/stores/' + created.body.slug)).body.store.settings;
  const edited = await platform(`stores/${created.body.id}/settings`, 'PUT', {
    name: 'Content </script><script>alert(1)</script>',
    version: 1,
    settings: {
      ...cfg,
      telegram: 'content_shop',
      texts: {
        ...cfg.texts,
        about_body: 'We make <ceramics> & textiles.',
        returns_body: 'Contact our shop with your order number.',
        faq_1_question: 'Can I request dimensions?',
        faq_1_answer: 'Yes, ask about the exact item.',
        faq_2_question: '',
        faq_2_answer: '',
        faq_3_question: '',
        faq_3_answer: '',
      },
    },
  });
  assert.equal(edited.status, 200);
  const page = await req('/s/' + created.body.slug);
  assert.match(page.body, /We make &lt;ceramics&gt; &amp; textiles/);
  assert.match(page.body, /Can I request dimensions/);
  assert.equal((page.body.match(/<details>/g) || []).length, 1);
  assert.match(page.body, /id="store-contacts"/);
  assert.match(page.body, /href="https:\/\/t.me\/content_shop"/);
  assert.doesNotMatch(page.body, /<script>alert\(1\)<\/script>/);
  const data = JSON.parse(
    page.body.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1],
  );
  assert.equal(data.name, 'Content </script><script>alert(1)</script>');
  assert.deepEqual(data.sameAs, ['https://t.me/content_shop']);
});

test('live stores do not acquire sample policies; new content obeys existing validation limits', async () => {
  const created = await platform('stores', 'POST', {
    name: 'Live content',
    settings: { texts: {} },
  });
  assert.equal(created.status, 201);
  await db.prepare("UPDATE stores SET status='active' WHERE id=?").bind(created.body.id).run();
  const page = await req('/s/' + created.body.slug);
  assert.doesNotMatch(page.body, /id="store-faq"|id="store-returns"|noindex, follow/);
  const cfg = (await req('/api/stores/' + created.body.slug)).body.store.settings;
  const bad = await platform(`stores/${created.body.id}/settings`, 'PUT', {
    name: 'Live content',
    version: 1,
    settings: { ...cfg, texts: { faq_1_answer: 'x'.repeat(501) } },
  });
  assert.equal(bad.status, 400);
});
