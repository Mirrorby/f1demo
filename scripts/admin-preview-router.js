// This wrapper can be applied to the pinned production bundle without changing its APIs.
export function previewRouter(handler) {
  return function (request, env, ctx) {
    const url = new URL(request.url);
    if (
      env.ADMIN_PREVIEW_ORIGIN &&
      /^\/admin\/?$/.test(url.pathname) &&
      url.searchParams.get('version') !== 'stable' &&
      url.hostname === new URL(env.PUBLIC_ORIGIN).hostname
    ) {
      const target = new URL('/admin' + url.search, env.ADMIN_PREVIEW_ORIGIN);
      return Response.redirect(target.href, 302);
    }
    return handler.call(this, request, env, ctx);
  };
}
