const fs = require('fs')
const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const PrerenderSPAPlugin = require('prerender-spa-plugin')
const SitemapPlugin = require('sitemap-webpack-plugin').default
const rewirePreact = require('react-app-rewire-preact')
const rewireEslint = require('react-app-rewire-eslint')
const marked = require('marked')
const fm = require('front-matter')
const hero = require('./src/_data/hero')
const parseBlog = require('./src/parse-blog')

// Escape html
const escapeHtml = unsafe => {
  return unsafe.replace(/[&<"']/g, m => {
    switch (m) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '"':
        return '&quot;'
      default:
        return '&#039;'
    }
  })
}

const feedMapper = fileName => {
  // Setup path to file
  const filePath = path.join(path.join('src', '_posts'), fileName)

  // Read the content of the file
  const fileContent = fs.readFileSync(filePath, 'utf-8')

  // Extract front-matter context
  const frontMatterContext = fm(fileContent)

  // Parse blog metadata
  const { id, date } = parseBlog(fileName)

  // Make marked generate valid XHTML
  marked.setOptions({
    xhtml: true
  })

  // Extract metadata
  const title = escapeHtml(frontMatterContext.attributes.title)
  const description = escapeHtml(frontMatterContext.attributes.description)
  const author = escapeHtml(frontMatterContext.attributes.author)
  const body = marked(frontMatterContext.body)
  const url = `${hero.url}/blog/show/${id}`

  return {
    url,
    title,
    author,
    content: body,
    summary: description,
    updated: date.toISOString()
  }
}

module.exports = function override (config, env) {
  config = rewirePreact(config, env)
  config = rewireEslint(config, env)

  const posts = fs.readdirSync(path.join('src', '_posts'))
  const routes = ['/', '/features', '/blog'].concat(
    posts.map(fileName => '/blog/show/' + parseBlog(fileName).id)
  )

  if (!process.env.NOW) {
    config.plugins.push(
      new PrerenderSPAPlugin({
        // Required - The path to the webpack-outputted app to prerender.
        staticDir: path.join(__dirname, 'build'),
        // Required - Routes to render.
        routes
      })
    )
  }

  config.plugins.push(
    new SitemapPlugin(hero.url, routes.map(path => ({ path })), {
      lastMod: true,
      changeFreq: 'weekly'
    })
  )

  config.plugins.push(
    new HtmlWebpackPlugin({
      feed: {
        url: hero.url,
        title: hero.title,
        subtitle: hero.description,
        entries: posts.map(feedMapper).reverse()
      },
      template: 'public/atom.html',
      filename: 'atom.xml',
      inject: false,
      xhtml: false
    })
  )

  return config
}
