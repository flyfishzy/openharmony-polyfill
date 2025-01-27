import fileio from '@ohos.fileio';
import { Writable, Readable } from 'stream-browserify';
//globalThis.process = require('process');

const FILE_TYPE = { File: 1, Dirent: 2 };
//type BufferEncoding = 'ascii' | 'utf8' | 'utf-8' | 'utf16le' | 'ucs2' | 'ucs-2' | 'base64' | 'base64url' | 'latin1' | 'binary' | 'hex';
// 1.File 2.Dirent
const fileType = Symbol('type');
const flagDic = {
  a: 0o1 | 0o100 | 0o2000,
  ax: 0o1 | 0o100 | 0o200 | 0o2000,
  'a+': 0o2 | 0o100 | 0o2000,
  'ax+': 0o2 | 0o100 | 0o200 | 0o2000,
  as: 0o1 | 0o100 | 0o2000 | 0o4010000,
  'as+': 0o2 | 0o100 | 0o2000 | 0o4010000,
  r: 0o0,
  'r+': 0o2,
  'rs+': 0o2 | 0o4010000,
  w: 0o1 | 0o100 | 0o1000,
  wx: 0o1 | 0o100 | 0o2000 | 0o1000,
  'w+': 0o2 | 0o100 | 0o1000,
  'wx+': 0o2 | 0o100 | 0o2000 | 0o1000
};

export class ReadStream extends Readable {
  /**
   * {string}Absolute path of the target file of stream
   */
  path;

  /**
   * {number}File descriptor of the target file of stream
   */
  fd;

  /**
   * {boolean}True before 'ready' event is activated
   */
  pending;

  /**
   * {number}Cumulative bytes that is read into stream
   */
  bytesRead;

  constructor(path, options) {
    let constructOptions = {};
    constructOptions.highWaterMark = options['highWaterMark'] || 65536;
    constructOptions.defaultEncoding = options['encoding'] || 'utf8';
    constructOptions.emitClose = options['emitClose'] || 'true';
    constructOptions.autoDestroy = options['autoClose'] || 'true';
    super(constructOptions);

    this.options = {};
    if (!options) {
      options = {};
    }

    this.options['flags'] = options.flags || 'r';
    this.options['encoding'] = options.encoding || 'utf8';
    this.options['fd'] = options.fd || null;
    this.options['mode'] = options.mode || 0o666;
    this.options['autoClose'] = options.autoClose || true;
    this.options['emitClose'] = options.emitClose || true;
    this.options['start'] = options.start;
    this.options['end'] = options.end || Infinity;
    this.options['fs'] = options.fs || null;
    if (this.options['encoding'] != 'utf8') {
      throw 'Only utf8 is supported in HarmonyOS!';
    }

    this.path = path;
    this.pending = true;
    this.fd = null;
    this.openHandler();
    this.readyHandler();
    this.bytesRead = 0;
    this.construct();
  }

  /**
   * construct
   * Supplementary constructor
   */
  construct() {
    if (this.options['fd']) {
      this.fd = this.options['fd'];
      this.path = undefined;
    } else {
      try {
        this.fd = fileio.openSync(
          this.path.toString(),
          flagDic[this.options['flags']],
          this.options['mode']
        );
        this.emit('open', this.fd);
      } catch (err) {
        console.error(err);
        throw err;
      }
    }
  }

  /**
   * _read
   * @param {number}n: Number of bytes to read
   * Private function called by build-in function of Readable Class
   * to read a chunk of buffer from target file, might be called several times in a stream
   */
  _read(n) {
    let Buffer = require('buffer').Buffer;
    let size = n || 4096;
    let arrbuf = new ArrayBuffer(size);
    let buf = Buffer.alloc(size);
    let readOptions = {};
    if (this.options['start']) {
      readOptions.position = this.options['start'];
    }
    if (this.options['end']) {
      readOptions.length = this.options['end'] - this.options['start'];
    }

    try {
      let bytesRead = fileio.readSync(
        this.fd,
        arrbuf,
        flagDic[this.options['flags']]
      );
      this.bytesRead += bytesRead;
      buf = Buffer.from(arrbuf);
      this.push(bytesRead > 0 ? buf.slice(0, bytesRead) : null);
    } catch (err) {
      console.error(err);
      this.destroy(err);
    }
  }

  /**
   * _destroy
   * @param {Error|null} err: Pass-in Error to indicate the reason to destroy the stream
   * @param {function} callback
   * Private function called by build-in function of Readable Class
   * to destroy stream, will activate 'close' event and, if error occurs, 'error' event.
   */
  _destroy(err, callback) {
    if (typeof callback != 'function') {
      callback = function (err) {
        if (err) {
          throw err;
        }
      };
    }
    if (this.fd) {
      fileio.close(this.fd, (er) => {
        callback(er || err);
      });
    } else {
      callback(err);
    }
  }

  openHandler() {
    this.on('open', (fd) => {
      this.emit('ready');
    });
  }

  readyHandler() {
    this.on('ready', () => {
      this.pending = false;
    });
  }

  /**
   * close
   * @param {function} callback
   * Manually close the readstream
   */
  close(callback) {
    if (typeof callback != 'function') {
      callback = function (err) {
        if (err) {
          throw err;
        }
      };
    }
    this.destroy(null, callback);
  }
}

export class WriteStream extends Writable {
  /**
   * {string}Absolute path of the target file of stream
   */
  path;

  /**
   * {number}File descriptor of the target file of stream
   */
  fd;

  /**
   * {boolean}True before 'ready' event is activated
   */
  pending;

  /**
   * {number}Cumulative bytes that stream has written
   */
  bytesWritten;

  constructor(path, options) {
    let constructOptions = {};
    constructOptions.defaultEncoding = options['encoding'] || 'utf8';
    constructOptions.emitClose = options['emitClose'] || 'true';
    constructOptions.autoDestroy = options['autoClose'] || 'true';
    super(constructOptions);

    this.options = {};
    if (!options) {
      options = {};
    }

    this.options['flags'] = options.flags || 'w';
    this.options['encoding'] = options.encoding || 'utf8';
    this.options['fd'] = options.fd || null;
    this.options['mode'] = options.mode || 0o666;
    this.options['autoClose'] = options.autoClose || true;
    this.options['emitClose'] = options.emitClose || true;
    this.options['start'] = options.start;
    this.options['fs'] = options.fs || null;
    if (this.options['encoding'] != 'utf8') {
      throw 'Only utf8 is supported in HarmonyOS!';
    }

    this.path = path;
    this.pending = true;
    this.fd = null;
    this.openHandler();
    this.readyHandler();
    this.bytesWritten = 0;
    this.construct();
  }

  /**
   * construct
   * Supplementary constructor
   */
  construct() {
    if (this.options['fd']) {
      this.fd = this.options['fd'];
      this.path = undefined;
    } else {
      try {
        this.fd = fileio.openSync(
          this.path.toString(),
          flagDic[this.options['flags']],
          this.options['mode']
        );
        this.emit('open', this.fd);
      } catch (err) {
        console.error(err);
        throw err;
      }
    }
  }

  /**
   * _write
   * @param {string|buffer} chunk: String or Buffer to write
   * @param {*} encoding: Encoding of 'chunk' if it is a string
   * @param {*} callback: Function to deal with error
   * Private function called by build-in function of Writable Class
   * to write a chunk of string or buffer to target file
   */
  _write(chunk, encoding, callback) {
    if (encoding) {
      if (typeof encoding == 'function') {
        callback = encoding;
      } else {
        if (encoding != 'utf8' && encoding != 'buffer') {
          throw 'Only utf8 and buffer is supported to write in HarmonyOS!';
        }
        if (typeof callback != 'function') {
          callback = function (err) {
            if (err) {
              throw err;
            }
          };
        }
      }
    }
    let writeOptions = {};
    if (this.options['start']) {
      writeOptions.position = this.options['start'];
    }
    fileio.write(
      this.fd,
      chunk.toString(),
      writeOptions,
      (err, bytesWritten) => {
        if (err) {
          console.error(err);
          callback(err);
        } else {
          this.bytesWritten += bytesWritten;
          callback(null);
        }
      }
    );
  }

  /**
   * _destroy
   * @param {Error|null} err: Pass-in Error to indicate the reason to destroy the stream
   * @param {function} callback
   * Private function called by build-in function of Readable Class
   * to destroy stream, will activate 'close' event and, if error occurs, 'error' event.
   */
  _destroy(err, callback) {
    if (typeof callback != 'function') {
      callback = function (err) {
        if (err) {
          throw err;
        }
      };
    }
    if (this.fd) {
      fileio.close(this.fd, (er) => {
        callback(er || err);
      });
    } else {
      callback(err);
    }
  }

  openHandler() {
    this.on('open', (fd) => {
      this.emit('ready');
    });
  }

  readyHandler() {
    this.on('ready', () => {
      this.pending = false;
    });
  }

  /**
   * close
   * @param {function} callback
   * Manually close the readstream
   */
  close(callback) {
    if (typeof callback != 'function') {
      callback = function (err) {
        if (err) {
          throw err;
        }
      };
    }
    this.destroy(null, callback);
  }
}

/**
 * Reads the contents of the directory.
 * @param {string} path - directory path
 * @param {string | Object } [options = { encoding : 'utf-8', withFileTypes: false}] - The optional options argument can
 * be a string specifying an encoding, or an object with an encoding property specifying the character encoding to use
 * for the filenames returned.
 * @returns {string[] | fileio.Dirent[]}
 */
export function readdirSync(path, options) {
  if (!path || !path.toString || !path.toString()) {
    throw 'Data input cannot be converted to string.';
  }
  const dirStream = fileio.opendirSync(path.toString());
  let dirent;
  const result = [];

  if (!options) {
    options = { encoding: 'utf-8', withFileTypes: false };
  }

  // eslint-disable-next-line
  while (true) {
    dirent = dirStream.readSync();
    if (!dirent) {
      dirStream.closeSync();
      break;
    }

    if (options.withFileTypes) {
      Object.defineProperty(dirent, fileType, {
        value: dirent.isDirectory() ? FILE_TYPE.Dirent : FILE_TYPE.File,
        enumerable: true
      });

      dirent.toJSON = function () {
        return { name: this.name };
      };
      result.push(dirent);
    } else {
      result.push(dirent.name);
    }
  }
  return result;
}

/**
 * readFileSync
 * @param {string|Buffer|integer}path
 * @param options
 * @returns {string | Buffer}
 */
export function readFileSync(path, options) {
  if (!options) {
    options = {};
  }
  let Buffer = require('buffer').Buffer;
  const mode = options.flag || 'r';
  let stream;
  if (Number.isInteger(path)) {
    stream = fileio.fdopenStreamSync(path, mode);
  } else {
    if (!path || !path.toString || !path.toString()) {
      throw 'Data input cannot be converted to string.';
    }
    stream = fileio.createStreamSync(path.toString(), mode);
  }

  let data = [];
  let count = 0;
  // eslint-disable-next-line
  while (true) {
    let buffer = new ArrayBuffer(4096);
    let num = stream.readSync(buffer);
    if (0 == num) {
      break;
    }
    if (num < 4096) {
      data.push(buffer.slice(0, num));
    } else {
      data.push(buffer);
    }
    count += num;
  }
  stream.closeSync();
  //const buffer = new Buffer(count);
  const buffer = Buffer.alloc(count);
  let offset = 0;

  for (let arr of data) {
    let uint8Arr = new Uint8Array(arr);
    buffer.set(uint8Arr, offset);
    offset += arr.byteLength;
  }

  if (options.encoding) {
    return buffer.toString(options.encoding);
  }
  return buffer;
}

/**
 * exists
 * @param {string|buffer}path
 * @param {(boolean isExists)=>any}callback: isExists = true if the file exists, false otherwise
 */
export function exists(path, callback) {
  if (!path || !path.toString || !path.toString()) {
    throw 'Data input cannot be converted to string.';
  }
  fileio.access(path.toString(), (err) => {
    if (err) {
      callback(false);
      console.error(err);
    } else {
      callback(true);
    }
  });
}

/**
 * Returns true if the path exists, false otherwise.
 * @param {string|Buffer} path
 * @returns {boolean}
 */
export function existsSync(path) {
  if (!path || !path.toString || !path.toString()) {
    throw 'Data input cannot be converted to string.';
  }
  try {
    fileio.accessSync(path.toString());
    return true;
  } catch (e) {
    if (e.message == 'No such file or directory') {
      return false;
    }
    throw e;
  }
}

/**
 * stat
 * @param {string|Buffer}path
 * @param {object}options
 * @param {function}callback
 */
export function stat(path, options, callback) {
  if (typeof options == 'function') {
    callback = options;
  }
  if (!options) {
    options = {};
  }

  if (typeof callback == 'function') {
    statPromises(path, options)
      .then((stat) => callback(null, stat))
      .catch((err) => callback(err, null));
  } else {
    return statPromises(path, options);
  }
}

export function statPromises(path, options) {
  function _statP(resolve, reject) {
    let _bigint = options.bigint || false;
    if (!path || !path.toString || !path.toString()) {
      throw 'Data input cannot be converted to string.';
    }

    fileio.stat(path.toString(), async function (err, _stat) {
      if (err) {
        reject(err);
        return;
      }

      let stat = {};
      let prop = [
        '_napiwrapper',
        'dev',
        'ino',
        'mode',
        'nlink',
        'uid',
        'gid',
        'rdev',
        'size',
        'blocks',
        'atime',
        'mtime',
        'ctime',
        'isBlockDevice',
        'isCharacterDevice',
        'isDirectory',
        'isFIFO',
        'isFile',
        'isSocket',
        'isSymbolicLink'
      ];
      let time_prop = ['atime', 'mtime', 'ctime'];

      try {
        for (let property of prop) {
          stat[property] = _stat[property];
        }
        if (_bigint) {
          for (let status of time_prop) {
            if (stat[status]) {
              stat[status + 'Ms'] = stat[status];
              stat[status + 'Ns'] = stat[status] * 1000000;
              stat[status] = new Date();
              stat[status].setTime(stat[status + 'Ms']);
              prop.push(status + 'Ms', status + 'Ns');
            }
          }
          for (let property of prop) {
            if (!isNaN(stat[property])) {
              stat[property] = BigInt(stat[property]);
            }
          }
        } else {
          for (let status of time_prop) {
            if (stat[status]) {
              stat[status + 'Ms'] = stat[status];
              stat[status] = new Date();
              stat[status].setTime(stat[status + 'Ms']);
            }
          }
        }
      } catch (err) {
        reject(err);
        return;
      }

      Object.freeze(stat);
      resolve(stat);
    });
  }

  const Promises = require('promise');
  return new Promises(_statP);
}

/**
 * statSync
 * @param {string|Buffer}path
 * @param {object}options
 * @return {Stat}
 */
export function statSync(path, options) {
  if (!options) {
    options = {};
  }
  let _bigint = options.bigint || false;
  let _throwIfNoEntry = options.throwIfNoEntry || true;
  if (!path || !path.toString || !path.toString()) {
    throw 'Data input cannot be converted to string.';
  }
  try {
    fileio.accessSync(path.toString());
  } catch (err) {
    if (_throwIfNoEntry) {
      console.error(err);
      throw err;
    } else {
      return undefined;
    }
  }

  let _stat = fileio.statSync(path.toString());
  let stat = {};
  let prop = [
    '_napiwrapper',
    'dev',
    'ino',
    'mode',
    'nlink',
    'uid',
    'gid',
    'rdev',
    'size',
    'blocks',
    'atime',
    'mtime',
    'ctime',
    'isBlockDevice',
    'isCharacterDevice',
    'isDirectory',
    'isFIFO',
    'isFile',
    'isSocket',
    'isSymbolicLink'
  ];
  let time_prop = ['atime', 'mtime', 'ctime'];

  for (let property of prop) {
    stat[property] = _stat[property];
  }
  if (_bigint) {
    for (let status of time_prop) {
      if (stat[status]) {
        stat[status + 'Ms'] = stat[status];
        stat[status + 'Ns'] = stat[status] * 1000000;
        stat[status] = new Date();
        stat[status].setTime(stat[status + 'Ms']);
        prop.push(status + 'Ms', status + 'Ns');
      }
    }
    for (let property of prop) {
      if (!isNaN(stat[property])) {
        stat[property] = BigInt(stat[property]);
      }
    }
  } else {
    for (let status of time_prop) {
      if (stat[status]) {
        stat[status + 'Ms'] = stat[status];
        stat[status] = new Date();
        stat[status].setTime(stat[status + 'Ms']);
      }
    }
  }

  Object.freeze(stat);
  return stat;
}

/**
 * write
 * @param {integer}fd
 * @param {string|buffer|Object}buffer
 * @param {integer}offset
 * @param {integer}length
 * @param {integer}position
 * @param {function}callback:
 * @callback_param {Error}err
 * @callback_param {integer}bytesWritten
 * @callback_param {Buffer}buffer
 */
//Important Notice: If content is inserted behind any empty bytes(\0),
//such content cannot be displayed because Openharmony cannot recognize '\0'
export function write(fd, buffer, offset, length, position, callback) {
  var options = {};
  //Another version of write is defined as:
  //fs.write(fd, string[, position[,encoding]], callback)
  if (typeof buffer == 'string') {
    if (typeof offset == 'function') {
      callback = offset; //'offset' corresponds to callback
      options = {};
    } else {
      options['position'] = offset; //'offset' corresponds to position
      if (typeof length == 'function') {
        callback = length; //'length' corresponds to encoding
      } else {
        options['encoding'] = length;
      }
    }
  } else {
    if (!buffer || !buffer.toString || !buffer.toString()) {
      throw 'Buffer input cannot be converted to string.';
    }

    if (typeof offset == 'function') {
      callback = offset;
      options = {};
    } else {
      options['offset'] = offset;
      if (typeof length == 'function') {
        callback = length;
      } else {
        options['length'] = length;
        if (typeof position == 'function') {
          callback = position;
        } else {
          options['position'] = position;
        }
      }
    }
  }

  if (options.position) {
    if (typeof options.position != 'number') {
      delete options.position;
    }
  }
  if (options.encoding) {
    if (options.encoding != 'utf8') {
      throw 'Only utf8 is supported to write!';
    }
  }
  fileio.write(fd, buffer, options, (err, bytesWritten) => {
    callback(err, bytesWritten, buffer);
  });
}

/**
 * Write data to files
 * @param {string|buffer|integer} file: path of the file
 * @param {string|Buffer|object} data: content of data to write
 * @param {string | Object } [options = { encoding : 'utf-8', flag: 'w', mode: 0o666}] - The optional options argument can
 * be a string specifying an encoding, or an object with an encoding property specifying the character encoding to use
 * for the data written(now only utf8 is supported), a flag property specifying the mode to open the file and
 * a mode property specifying the permission of the file if being created.
 */
export function writeFileSync(file, data, options) {
  const { options: op } = writeFileParamFormat(file, data, options);
  const flag = op.flag || 'w';
  const mode = op.mode || 0o666;
  if (Number.isInteger(file)) {
    try {
      fileio.writeSync(file, data.toString());
    } catch (err) {
      console.error(err);
      throw (
        'Write File failed at ' + file + '! ' + err.name + ':' + err.message
      );
    }
  } else {
    if (!file || !file.toString || !file.toString()) {
      throw 'Data input cannot be converted to string.';
    }
    try {
      let fd = fileio.openSync(file.toString(), flagDic[flag], mode);
      fileio.writeSync(fd, data.toString());
    } catch (err) {
      console.error(err);
      throw (
        'Write File failed at ' + file + '! ' + err.name + ':' + err.message
      );
    }
  }
}

export function appendFileSync(file, data, options = {}) {
  const { options: op } = writeFileParamFormat(file, data, options);
  const flag = op.flag || 'a';
  const mode = op.mode || 0o666;
  if (Number.isInteger(file)) {
    fileio.writeSync(file, data.toString());
  } else {
    let fd = fileio.openSync(file.toString(), flagDic[flag], mode);
    fileio.writeSync(fd, data.toString());
  }
}

export function appendFile(file, data, options = {}, callback) {
  const { options: op, callback: fn } = writeFileParamFormat(
    file,
    data,
    options,
    callback
  );
  const flag = op.flag ?? 'a';
  const mode = op.mode ?? 0o666;
  if (Number.isInteger(file)) {
    fileio
      .write(file, data.toString())
      .then(() => fn())
      .catch((err) => fn(err));
  } else {
    const promise = new Promise((resolve) => {
      const fd = fileio.openSync(file.toString(), flagDic[flag], mode);
      resolve(fd);
    });
    promise
      .then((fd) => writeFile(fd, data.toString()))
      .then(() => fn())
      .catch((err) => fn(err));
  }
}

export function writeFileParamFormat(file, data, options = {}, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (!data || !data.toString || !data.toString()) {
    throw 'Data input cannot be converted to string.';
  }
  let coding;
  if (typeof options == 'string') {
    coding = options;
  } else {
    coding = options.encoding || 'utf8';
  }
  if (coding !== 'utf8') {
    throw 'Only utf8 is supported to write';
  }
  return { options: options, callback: callback };
}

export function writeFile(file, data, options, callback) {
  const { options: op, callback: fn } = writeFileParamFormat(
    file,
    data,
    options,
    callback
  );
  const flag = op.flag || 'w';
  const mode = op.mode || 0o666;
  if (Number.isInteger(file)) {
    fileio
      .write(file, data.toString())
      .then(() => fn())
      .catch((err) => fn(err));
  } else {
    if (!file || !file.toString || !file.toString()) {
      throw 'Data input cannot be converted to string.';
    }
    new Promise((resolve) =>
      resolve(fileio.openSync(file.toString(), flagDic[flag], mode))
    )
      .then((fd) => fileio.write(fd, data.toString()))
      .then(() => fn())
      .catch((err) => fn(err));
  }
}

/**
 * createReadStream
 * @param {string|Buffer}path
 * @param {object|string}options
 */
export function createReadStream(path, options) {
  if (!path || !path.toString || !path.toString()) {
    throw 'Data input cannot be converted to string.';
  }
  if (!options) {
    options = {};
  }
  if (typeof options == 'string') {
    options = { encoding: options };
  }
  let stream = new ReadStream(path, options);
  return stream;
}

/**
 * createWriteStream
 * @param {string|Buffer}path
 * @param {object|string}options
 */
export function createWriteStream(path, options) {
  if (!path || !path.toString || !path.toString()) {
    throw 'Data input cannot be converted to string.';
  }
  if (!options) {
    options = {};
  }
  if (typeof options == 'string') {
    options = { encoding: options };
  }
  let stream = new WriteStream(path, options);
  return stream;
}

/**
 * Delete a file
 * @param {string | Buffer} path: The path of the file to delete
 */
export function unlinkSync(path) {
  if (!path || !path.toString || !path.toString()) {
    throw 'Data input cannot be converted to string.';
  }
  try {
    let file = path.toString();
    fileio.unlinkSync(file);
  } catch (e) {
    console.error(e);
    throw (
      'Delete fail at ' + path.toString() + '! ' + e.name + ': ' + e.message
    );
  }
}

/**
 * readFile callback
 *
 * @callback readFileCallback
 * @param {Error} err
 * @param {string  | Buffer} data
 */

/**
 * readFile
 * @param {string} path
 * @param {string | Object } [options = { encoding : null, flag: 'r',signal: AbortSignal}]  [options]
 * @param {readFileCallback } callback
 */
export function readFile(path, options, callback) {
  if (typeof options == 'function') {
    callback = options;
  }

  if (!options) {
    options = {};
  }

  if (typeof callback == 'function') {
    readFilePromises(path, options)
      .then((data) => callback(null, data))
      .catch((err) => callback(err, null));
  } else {
    return readFilePromises(path, options);
  }
}

export function readFilePromises(path, options) {
  if (!options) {
    options = {};
  }

  function _readFile(resolve, reject) {
    let Buffer = require('buffer').Buffer;
    const mode = options.flag || 'r';

    if (!path || !path.toString || !path.toString()) {
      throw 'Data input cannot be converted to string.';
    }
    fileio.createStream(path.toString(), mode, async function (err, stream) {
      if (err) {
        reject(err);
        return;
      }

      let data = [];
      let count = 0;
      let readOut;
      try {
        // eslint-disable-next-line
        while (true) {
          readOut = await stream.read(new ArrayBuffer(4096));
          if (0 == readOut.bytesRead) {
            break;
          }
          if (readOut.bytesRead < 4096) {
            data.push(readOut.buffer.slice(0, readOut.bytesRead));
          } else {
            data.push(readOut.buffer);
          }
          count += readOut.bytesRead;
        }
      } catch (error) {
        reject(error);
        return;
      }

      stream.closeSync();
      // const buffer = new Buffer(count);
      const buffer = Buffer.alloc(count);
      let offset = 0;

      for (let arr of data) {
        let uint8Arr = new Uint8Array(arr);
        buffer.set(uint8Arr, offset);
        offset += arr.byteLength;
      }

      if (options.encoding) {
        resolve(buffer.toString(options.encoding));
      } else {
        resolve(buffer);
      }
    });
  }

  const Promises = require('promise');
  return new Promises(_readFile);
}

/**
 * If it is recursive mode returns the first created directory, otherwise it returns undefined
 * @param {string} path
 * @param { Object } [options = { recursive: false, mode: 0o777}]
 */
export function mkdirSync(path, options) {
  options = mkdirParamFormat(options);
  if (options.recursive) {
    // when options.recursive is true need to return the first created directory
    const obj = {};
    mkdirRecursive(path, options, obj);
    return obj.path;
  } else {
    fileio.mkdirSync(path, options.mode);
  }
}

/**
 * If it is recursive mode returns the first created directory, otherwise it returns undefined
 * @param {string} path
 * @param { Object } [options = { recursive: false, mode: 0o777}]
 * @param {function(err,[path]) } callback
 */
export function mkdir(path, options, callback) {
  options = mkdirParamFormat(options);
  if (options.recursive) {
    // when options.recursive is true need to return the first created directory
    const obj = {};
    mkdirRecursiveAsync(path, options, obj)
      .then(() => {
        callback(undefined, obj.path);
      })
      .catch((err) => {
        callback(err, obj.path);
      });
  } else {
    fileio.mkdir(path, options.mode, callback);
  }
}

function mkdirRecursive(path, options, obj) {
  try {
    fileio.accessSync(path);
    return true;
  } catch (e) {
    if (mkdirRecursive(dirname(path), options, obj)) {
      fileio.mkdirSync(path, options.mode);
      // record the first create path in recursive mode
      obj.path = obj.path ?? path;
      return true;
    }
  }
}

async function mkdirRecursiveAsync(path, options, obj) {
  try {
    await fileio.access(path);
    return true;
  } catch (e) {
    if (await mkdirRecursiveAsync(dirname(path), options, obj)) {
      await fileio.mkdir(path, options.mode);
      obj.path = obj.path ?? path;
      return true;
    }
  }
}

function mkdirParamFormat(options) {
  options = options ?? {};
  options.recursive = options.recursive ?? false;
  options.mode = options.mode ?? 0o777;
  if (typeof options.mode === 'string') {
    options.mode = Number(options.mode);
  }
  return options;
}

export function dirname(path) {
  if (path.length === 0) return '.';
  let code = path.charCodeAt(0);
  const hasRoot = code === 47;
  let end = -1;
  let matchedSlash = true;
  for (let i = path.length - 1; i >= 1; --i) {
    code = path.charCodeAt(i);
    if (code === 47) {
      if (!matchedSlash) {
        end = i;
        break;
      }
    } else {
      // We saw the first non-path separator
      matchedSlash = false;
    }
  }

  if (end === -1) return hasRoot ? '/' : '.';
  if (hasRoot && end === 1) return '//';
  return path.slice(0, end);
}

export function closeSync(fd) {
  fileio.closeSync(fd);
}

export function close(fd, callback = () => {}) {
  fileio
    .close(fd)
    .then(() => callback())
    .catch((err) => callback(err));
}

/**
 * path[, flags[, mode]], callback
 */
export function open(path, flags, mode, callback) {
  if (arguments.length < 3) {
    callback = flags;
    flags = 'r';
    mode = 0o666;
  } else if (typeof mode === 'function') {
    callback = mode;
    mode = 0o666;
  }

  fileio
    .open(path, flagDic[flags], mode)
    .then((fd) => callback(undefined, fd))
    .catch((err) => callback(err));
}

/**
 * path[, flags[, mode]]
 */
export function openSync(path, flags = 'r', mode = 0o666) {
  return fileio.openSync(path, flagDic[flags], mode);
}

/**
 * path[, options], callback
 */
export function readdir(path, options, callback) {
  if (arguments.length === 2) {
    callback = options;
    options = { encoding: 'utf-8', withFileTypes: false };
  }

  fileio
    .opendir(path)
    .then((dirStream) => {
      let dirent;
      const result = [];
      while (null != (dirent = dirStream.readSync())) {
        result.push(options.withFileTypes ? dirent : dirent.name);
      }
      dirStream.closeSync();
      return result;
    })
    .then((res) => callback(undefined, res))
    .catch((err) => callback(err));
}
