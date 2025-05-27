// BamlImage class is assumed to be defined and available from your BAML setup
// For example, it might be part of a core BAML library or generated separately.
// If not, you might need to define it or import it if it's in another baml file.
// For now, we assume 'Image' is a known type to BAML.

class BamlThought {
  variant "thought"
  timestamp string
  message string
}

class BamlTurn {
  variant "turn"
  timestamp string
  action string 
  observations (string | image)[]
}

class ConnectorState {
  connector_id string
  elements (string | image)[]
}

class ModularMemoryContext {
  history (BamlThought | BamlTurn)[]
  current_timestamp string
  current_connector_states ConnectorState[]
}
