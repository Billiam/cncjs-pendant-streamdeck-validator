import { Validator } from './validate'
import fs from 'fs'

export const formatErrors = (errors, color = true) => {
  return errors.map((error) => {
    const isError = error.severity !== 'warning'
    let suffix
    if (error.line != null) {
      suffix = `L${error.line}:${error.column}`
    } else {
      suffix = `pos: ${error.from}`
    }
    return {
      color: isError ? 'red' : 'yellow',
      message: `${isError ? '✕' : '!'} ${error.message} - ${suffix}`,
    }
  })
}

export const validatePath = (path, color = true) => {
  const validate = Validator()
  const content = fs.readFileSync(path, 'utf8')
  const errors = validate(content)

  return {
    status: errors.length ? 'error' : 'ok',
    errors: formatErrors(errors, color),
  }
}
