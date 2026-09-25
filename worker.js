export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const prefix = '/Gym-Manager'

    // The custom domain route sends /Gym-Manager/* to this Worker,
    // while the built Vite assets live at the root of dist/.
    // Strip the public subpath before asking Workers Assets for the file.
    if (url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)) {
      const strippedPath = url.pathname.slice(prefix.length) || '/'
      url.pathname = strippedPath
      return env.ASSETS.fetch(new Request(url, request))
    }

    return env.ASSETS.fetch(request)
  },
}
