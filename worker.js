export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const prefixes = ['/gym-manager', '/Gym-Manager']

    // Gym Manager is published at /gym-manager/* on atelierog.co.in.
    // Accept the legacy capitalized path too, then normalize it before
    // resolving the Vite-built assets from Workers Assets.
    const matchedPrefix = prefixes.find((prefix) =>
      url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
    )

    if (matchedPrefix) {
      const strippedPath = url.pathname.slice(matchedPrefix.length) || '/'
      url.pathname = strippedPath
      return env.ASSETS.fetch(new Request(url, request))
    }

    return env.ASSETS.fetch(request)
  },
}
