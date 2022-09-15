import schema from './config.schema.json'
import { Validator as JSONValidator } from 'jsonschema'
import parser from 'json-source-map'

export const logicValidation = (config) => {
  if (!config) {
    return
  }

  const buttonList = Object.keys(config.buttons || {})
  const sceneList = Object.keys(config.scenes || {}) + ['gcodeList']
  const errors = []
  const warnings = []
  const sceneActions = {
    setScene: 0,
    navigate: 0,
    swapScene: 0,
    enterWcs: 1,
    enterPosition: 1,
  }
  const paletteCount = config?.ui?.palette?.length || 0
  const referencedScenes = new Set(['fileDetails', 'numpad', 'home'])
  const referencedButtons = new Set(['gcodeFile', 'gcodeFolder', 'sortScene'])

  const addButtonError = (button, path) => {
    if (buttonList.indexOf(button) !== -1) {
      return
    }
    const property = `instance.${path.join('.')}`
    const message = `${button} has not been defined`
    errors.push({
      path,
      property,
      message,
      stack: `${property} ${message}`,
    })
  }

  // validate buttons exist
  Object.entries(config.scenes || {}).forEach(([scene, data]) => {
    data?.buttons?.forEach((row, rowNum) => {
      row.forEach((button, column) => {
        if (
          button == null ||
          button === '' ||
          buttonList.indexOf(button) !== -1
        ) {
          return
        }

        if (Array.isArray(button)) {
          button.forEach((subButton, subColumn) => {
            const errorPath = [
              'scenes',
              scene,
              'buttons',
              rowNum,
              column,
              subColumn,
            ]
            addButtonError(subButton, errorPath)
          })
          return
        }

        const errorPath = ['scenes', scene, 'buttons', rowNum, column]
        addButtonError(button, errorPath)
      })
    })
  })

  // validate scenes fit in bounds
  const rows = config.ui?.rows ?? 3
  const columns = config.ui?.columns ?? 5

  Object.entries(config.scenes || {}).forEach(([scene, data]) => {
    if (data?.buttons?.length > rows) {
      const errorPath = ['scenes', scene, 'buttons']
      const property = `instance.${errorPath.join('.')}`
      const message = 'has too many rows'
      errors.push({
        path: errorPath,
        property,
        message,
        stack: `${property} ${message}`,
      })
    }

    data?.buttons?.forEach((row, rowNum) => {
      if (row.length > columns) {
        const errorPath = ['scenes', scene, 'buttons', rowNum]
        const property = `instance.${errorPath.join('.')}`
        const message = 'has too many columns'
        errors.push({
          path: errorPath,
          property,
          message,
          stack: `${property} ${message}`,
        })
      }
    })
  })

  // validate scenes exist
  Object.entries(config.buttons || {}).forEach(([button, data]) => {
    if (data.actions == null) {
      return
    }

    data.actions.forEach((action, actionIndex) => {
      if (sceneActions[action.action] == null) {
        return
      }
      const position = sceneActions[action.action]
      if (action.arguments?.[position] == null) {
        return
      }
      referencedScenes.add(action.arguments[position])
      if (sceneList.indexOf(action.arguments[position]) === -1) {
        const errorPath = [
          'buttons',
          button,
          'actions',
          actionIndex,
          'arguments',
          position,
        ]
        const property = `instance.${errorPath.join('.')}`
        const message = `"${action.arguments[position]}" is not a valid scene name`
        errors.push({
          path: errorPath,
          property,
          message,
          stack: `${property} ${message}`,
        })
      }
    })
  })

  // validate global colors exist in palette
  ;['textColor', 'bgColor', 'pageColor', 'progressColor'].forEach((colorKey) => {
    if (typeof config.ui?.[colorKey] !== 'number') {
      return
    }
    const color = config.ui[colorKey]
    if (color < 0 || color > paletteCount) {
      const errorPath = ['ui', colorKey]
      const property = `instance.${errorPath.join('.')}`
      const message = `${color} does not exist in the palette`
      errors.push({
        path: errorPath,
        property,
        message,
        stack: `${property} ${message}`,
      })
    }
  })

  // validate colors exist in palette
  Object.entries(config.buttons || {}).forEach(([button, data]) => {
    if (typeof data.bgColor !== 'number') {
      return
    }

    if (data.bgColor < 0 || data.bgColor > paletteCount) {
      const errorPath = ['buttons', button, 'bgColor']
      const property = `instance.${errorPath.join('.')}`
      const message = `${data.bgColor} does not exist in the palette`
      errors.push({
        path: errorPath,
        property,
        message,
        stack: `${property} ${message}`,
      })
    }
  })

  // find unused buttons
  Object.entries(config.scenes || {}).forEach(([, data]) => {
    data?.buttons?.forEach((row) => {
      row.forEach((button) => {
        if (Array.isArray(button)) {
          button.forEach((subButton) => {
            referencedButtons.add(subButton)
          })
        } else {
          referencedButtons.add(button)
        }
      })
    })
  })
  Object.entries(config.buttons || {}).forEach(([button]) => {
    if (!referencedButtons.has(button)) {
      const errorPath = ['buttons', button]
      const property = `instance.${errorPath.join('.')}`
      const message = 'is not used in any scenes'
      warnings.push({
        path: errorPath,
        severity: 'warning',
        property,
        message,
        stack: `${property} ${message}`,
      })
    }
  })

  // find unused scenes
  Object.entries(config.scenes || {}).forEach(([scene]) => {
    if (!referencedScenes.has(scene)) {
      const errorPath = ['scenes', scene]
      const property = `instance.${errorPath.join('.')}`
      const message = 'is not used'

      warnings.push({
        severity: 'warning',
        path: errorPath,
        property,
        message,
        stack: `${property} ${message}`,
      })
    }
  })

  return { errors, warnings }
}

export const mapError = (error, pointers) => {
  let pointerList = error.path.slice()
  let from, to, line, column
  let keyError = false
  let message = error.stack
  if (error.name === 'additionalProperties') {
    pointerList.push(error.argument)
    keyError = true
  }
  // currently only used by actions
  if (error.name === 'oneOf') {
    message = `${error.property} is not a valid action`
  }

  const pointer = pointers[`/${pointerList.join('/')}`]

  if (keyError) {
    from = pointer.key.pos
    to = pointer.keyEnd.pos
    line = pointer.key.line
    column = pointer.key.column
  } else {
    from = pointer.value.pos
    to = pointer.valueEnd.pos
    line = pointer.value.line
    column = pointer.value.column
  }
  return {
    severity: error.severity ?? 'error',
    source: 'schema-lint',
    renderMessage: null,
    actions: [],
    message,
    from,
    to,
    line,
    column,
  }
}

export const validate = (validator, configStr) => {
  if (!configStr) {
    return []
  }
  let config

  try {
    config = parser.parse(configStr)
  } catch (e) {
    let from = 0,
      to = configStr.length

    if (e.name === 'SyntaxError') {
      const line = e.message.match(/at position (\d+)$/)
      if (line) {
        from = parseInt(line[1])
      }
    }

    return [
      {
        severity: 'error',
        source: 'JSON parse',
        message: e.message,
        from,
        to,
      },
    ]
  }

  const { errors: logicErrors, warnings } = logicValidation(config.data)
  const result = validator.validate(config.data, schema)
  const errors = [...result.errors, ...logicErrors, ...warnings]
  return errors.map((error) => mapError(error, config.pointers))
}

export const Validator = () => {
  const v = new JSONValidator()
  return validate.bind(null, v)
}
