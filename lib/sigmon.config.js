/**
 * Summary                Locates and loads sigmon configuration object.
 *
 * Description            Searches ./etc, ../etc, /etc, and /usr/local/etc for site.yaml file which contains
 *                        sigmon configuration information, along with other yaml files in this directory.
 *
 * @file   config.js
*/

const process = require('process'),
      path    = require('path'),
      yaml    = require('js-yaml'),
      fs      = require('fs')

const PATHS = [
        path.join(process.env.HOME,'.sigmon'),
        path.join(process.cwd(),'../etc'),
        path.join(process.cwd(),'etc'),
        path.join('/etc/','sigmon'),
        path.join('/usr/local/etc','sigmon')
]

const FILES = [
      'devices',
      'interface',
      'modules',
      'site',
      'zones'
      ]

var config = function() {
  this.base = null
  this.zone = null
  this._config = {}
  this.section = 'site'
  this.version = '0.0.0'

  PATHS.forEach(dir => {
    if(fs.existsSync(path.join(dir, 'site.yaml')))
      this.base = dir
  })

  if(this.base === null) {
    // cb: do I load logger.js? where does this go?
    console.error('No configuration file found!')
    process.exit(2)
  }
  
  module.paths.unshift(path.join(this.base, 'lib'))

  console.log(`Using ${this.base} for configuration files`)

  this._config = {}

  FILES.forEach(cfgfile => {
    this._config[cfgfile] = yaml.safeLoad(fs.readFileSync(path.join(this.base, `${cfgfile}.yaml`)))
  })

  this.zone = this._config.site.zone
  this.section = this._config.site.version

  return this
}


/**
 * Summary.                   Switch root paths in configuration object
 *
 * Description                Change path for config.get function
 *
 *
 *
 * @param {string}    section       Section to select
 */

config.prototype.module = function(section) {
  this.section = section
}


/**
 * Summary.                   Returns object root as selected by config.section
 *
 * Description                Returns config.section.arg, use config.module(section) to change
 *
 * @param {string}    arg     Argument or root to request
 */

config.prototype.get = function(arg) {
  return this._config[this.section][arg]
}

module.exports = { config }
