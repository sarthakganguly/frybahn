(() => {
  // lib/world.ts
  var WorldImpl = class {
    constructor(id, capacity = 1e4) {
      this.Signature = [];
      this.Graveyard = [];
      this.id = id;
      this.Capacity = capacity;
    }
  };
  function create_entity(world) {
    if (world.Graveyard.length > 0) {
      return world.Graveyard.pop();
    }
    if (world.Signature.length > world.Capacity) {
      throw new Error("No more entities available.");
    }
    return world.Signature.push(0) - 1;
  }
  function destroy_entity(world, entity) {
    world.Signature[entity] = 0;
    if (world.Graveyard.includes(entity)) {
      throw new Error("Entity already in graveyard.");
    }
    world.Graveyard.push(entity);
  }
  function first_having(world, query, start_at = 0) {
    for (let i = start_at; i < world.Signature.length; i++) {
      if ((world.Signature[i] & query) === query) {
        return i;
      }
    }
  }

  // lib/game.ts
  var update_span = document.getElementById("update");
  var delta_span = document.getElementById("delta");
  var fps_span = document.getElementById("fps");
  var step = 1 / 60;
  var GameImpl = class {
    constructor() {
      this.Running = 0;
      this.Now = 0;
      this.ViewportWidth = window.innerWidth;
      this.ViewportHeight = window.innerHeight;
      this.ViewportResized = true;
      this.InputState = {
        MouseX: 0,
        MouseY: 0
      };
      this.InputDelta = {
        MouseX: 0,
        MouseY: 0
      };
      this.InputDistance = {
        Mouse: 0,
        Mouse0: 0,
        Mouse1: 0,
        Mouse2: 0
      };
      this.Ui = document.querySelector("main");
      this.SceneCanvas = document.querySelector("#s");
      this.Gl = this.SceneCanvas.getContext("webgl2", { antialias: false });
      this.Audio = new AudioContext();
      this.Cameras = [];
      document.addEventListener("visibilitychange", () => document.hidden ? this.Stop() : this.Start());
      this.Ui.addEventListener("contextmenu", (evt) => evt.preventDefault());
      this.Ui.addEventListener("mousedown", (evt) => {
        this.InputState[`Mouse${evt.button}`] = 1;
        this.InputDelta[`Mouse${evt.button}`] = 1;
      });
      this.Ui.addEventListener("mouseup", (evt) => {
        this.InputState[`Mouse${evt.button}`] = 0;
        this.InputDelta[`Mouse${evt.button}`] = -1;
      });
      this.Ui.addEventListener("mousemove", (evt) => {
        this.InputState["MouseX"] = evt.clientX;
        this.InputState["MouseY"] = evt.clientY;
        this.InputDelta["MouseX"] = evt.movementX;
        this.InputDelta["MouseY"] = evt.movementY;
      });
      this.Ui.addEventListener("wheel", (evt) => {
        evt.preventDefault();
        this.InputDelta["WheelY"] = evt.deltaY;
      });
    }
    Start() {
      let last = performance.now();
      let tick = (now) => {
        let delta = (now - last) / 1e3;
        last = now;
        this.Running = requestAnimationFrame(tick);
        this.FrameSetup(delta);
        this.FrameUpdate(delta);
        this.FrameReset(delta);
      };
      this.Stop();
      requestAnimationFrame(tick);
    }
    Stop() {
      cancelAnimationFrame(this.Running);
      this.Running = 0;
    }
    FrameSetup(delta) {
      this.Now = performance.now();
      let mouse_distance = Math.abs(this.InputDelta["MouseX"]) + Math.abs(this.InputDelta["MouseY"]);
      this.InputDistance["Mouse"] += mouse_distance;
      if (this.InputState["Mouse0"] === 1) {
        this.InputDistance["Mouse0"] += mouse_distance;
      }
      if (this.InputState["Mouse1"] === 1) {
        this.InputDistance["Mouse1"] += mouse_distance;
      }
      if (this.InputState["Mouse2"] === 1) {
        this.InputDistance["Mouse2"] += mouse_distance;
      }
    }
    FrameReset(delta) {
      this.ViewportResized = false;
      if (this.InputDelta["Mouse0"] === -1) {
        this.InputDistance["Mouse0"] = 0;
      }
      if (this.InputDelta["Mouse1"] === -1) {
        this.InputDistance["Mouse1"] = 0;
      }
      if (this.InputDelta["Mouse2"] === -1) {
        this.InputDistance["Mouse2"] = 0;
      }
      for (let name in this.InputDelta) {
        this.InputDelta[name] = 0;
      }
      let update9 = performance.now() - this.Now;
      if (update_span) {
        update_span.textContent = update9.toFixed(1);
      }
      if (delta_span) {
        delta_span.textContent = (delta * 1e3).toFixed(1);
      }
      if (fps_span) {
        fps_span.textContent = (1 / delta).toFixed();
      }
    }
  };
  function instantiate(game, blueprint) {
    let entity = create_entity(game.World);
    for (let mixin of blueprint) {
      mixin(game, entity);
    }
    return entity;
  }

  // lib/webgl.ts
  var GL_DEPTH_BUFFER_BIT = 256;
  var GL_COLOR_BUFFER_BIT = 16384;
  var GL_TRIANGLE_STRIP = 5;
  var GL_STATIC_DRAW = 35044;
  var GL_STREAM_DRAW = 35040;
  var GL_ARRAY_BUFFER = 34962;
  var GL_DEPTH_TEST = 2929;
  var GL_SCISSOR_TEST = 3089;
  var GL_RGBA = 6408;
  var GL_PIXEL_UNSIGNED_BYTE = 5121;
  var GL_FRAGMENT_SHADER = 35632;
  var GL_VERTEX_SHADER = 35633;
  var GL_COMPILE_STATUS = 35713;
  var GL_LINK_STATUS = 35714;
  var GL_NEAREST = 9728;
  var GL_TEXTURE_MAG_FILTER = 10240;
  var GL_TEXTURE_MIN_FILTER = 10241;
  var GL_TEXTURE_2D = 3553;
  var GL_TEXTURE0 = 33984;
  var GL_FRAMEBUFFER = 36160;
  var GL_FLOAT = 5126;

  // materials/layout2d.ts
  var FLOATS_PER_INSTANCE = 16;
  var BYTES_PER_INSTANCE = FLOATS_PER_INSTANCE * 4;
  function setup_render2d_buffers(gl, instance_buffer) {
    let vertex_arr = Float32Array.from([
      -0.51,
      -0.51,
      0,
      1,
      0.51,
      -0.51,
      1,
      1,
      -0.51,
      0.51,
      0,
      0,
      0.51,
      0.51,
      1,
      0
    ]);
    gl.bindBuffer(GL_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(GL_ARRAY_BUFFER, vertex_arr, GL_STATIC_DRAW);
    gl.enableVertexAttribArray(0 /* VertexPosition */);
    gl.vertexAttribPointer(0 /* VertexPosition */, 2, GL_FLOAT, false, 4 * 4, 0);
    gl.enableVertexAttribArray(1 /* VertexTexCoord */);
    gl.vertexAttribPointer(1 /* VertexTexCoord */, 2, GL_FLOAT, false, 4 * 4, 4 * 2);
    gl.bindBuffer(GL_ARRAY_BUFFER, instance_buffer);
    gl.enableVertexAttribArray(2 /* InstanceRotation */);
    gl.vertexAttribDivisor(2 /* InstanceRotation */, 1);
    gl.vertexAttribPointer(2 /* InstanceRotation */, 4, GL_FLOAT, false, BYTES_PER_INSTANCE, 0);
    gl.enableVertexAttribArray(3 /* InstanceTranslation */);
    gl.vertexAttribDivisor(3 /* InstanceTranslation */, 1);
    gl.vertexAttribPointer(3 /* InstanceTranslation */, 4, GL_FLOAT, false, BYTES_PER_INSTANCE, 4 * 4);
    gl.enableVertexAttribArray(4 /* InstanceColor */);
    gl.vertexAttribDivisor(4 /* InstanceColor */, 1);
    gl.vertexAttribPointer(4 /* InstanceColor */, 4, GL_FLOAT, false, BYTES_PER_INSTANCE, 4 * 8);
    gl.enableVertexAttribArray(5 /* InstanceSprite */);
    gl.vertexAttribDivisor(5 /* InstanceSprite */, 1);
    gl.vertexAttribPointer(5 /* InstanceSprite */, 4, GL_FLOAT, false, BYTES_PER_INSTANCE, 4 * 12);
  }

  // src/world.ts
  var World = class extends WorldImpl {
    constructor() {
      super(...arguments);
      this.TotalWealth = 100;
      this.Age = 0;
      this.Milestone = 0;
      this.Population = 0;
      this.Immigration = 0;
      this.Mortality = 0;
      this.Happiness = 0;
      this.Nutrition = 0;
      this.Restedness = 0;
      this.Employment = 0;
      this.DuszkiAlive = 0;
      this.DuszkiWorking = 0;
      this.Width = 100;
      this.Height = 100;
      this.Grid = Array(this.Height).fill(0).map((_, y) => Array(this.Width).fill(0).map((_2, x) => ({
        Index: x + y * this.Width,
        Position: [x, y],
        TileEntity: null,
        Walkable: false,
        Pleasant: false,
        Ocupados: [],
        TrafficIntensity: 0,
        Type: 0 /* Other */,
        TimesWalked: 0,
        Updated: false
      })));
      this.InstanceData = new Float32Array(this.Capacity * FLOATS_PER_INSTANCE);
      this.Camera2D = [];
      this.ControlAi = [];
      this.ControlPlayer = [];
      this.Children = [];
      this.Generator = [];
      this.Follow = [];
      this.Lifespan = [];
      this.LocalTransform2D = [];
      this.Move2D = [];
      this.Needs = [];
      this.Render2D = [];
      this.Satisfy = [];
      this.SpatialNode2D = [];
      this.Walk = [];
    }
  };

  // src/components/com_children.ts
  function children(...blueprints) {
    return (game, entity) => {
      if (game.World.Signature[entity] & 32 /* Children */) {
      } else {
        game.World.Signature[entity] |= 32 /* Children */;
        game.World.Children[entity] = {
          Children: []
        };
      }
      let child_entities = game.World.Children[entity].Children;
      for (let blueprint of blueprints) {
        let child = instantiate(game, blueprint);
        child_entities.push(child);
      }
    };
  }
  function* query_down(world, entity, mask) {
    if ((world.Signature[entity] & mask) === mask) {
      yield entity;
    }
    if (world.Signature[entity] & 32 /* Children */) {
      for (let child of world.Children[entity].Children) {
        yield* query_down(world, child, mask);
      }
    }
  }
  function destroy_all(world, entity) {
    if (world.Signature[entity] & 32 /* Children */) {
      for (let child of world.Children[entity].Children) {
        destroy_all(world, child);
      }
    }
    if (world.Signature[entity] === 0 /* None */) {
    } else {
      destroy_entity(world, entity);
    }
  }

  // lib/vec2.ts
  function set(out, x, y) {
    out[0] = x;
    out[1] = y;
    return out;
  }
  function copy(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    return out;
  }
  function add(out, a, b) {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    return out;
  }
  function subtract(out, a, b) {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    return out;
  }
  function scale(out, a, b) {
    out[0] = a[0] * b;
    out[1] = a[1] * b;
    return out;
  }
  function normalize(out, a) {
    let x = a[0];
    let y = a[1];
    let len = x * x + y * y;
    if (len > 0) {
      len = 1 / Math.sqrt(len);
    }
    out[0] = a[0] * len;
    out[1] = a[1] * len;
    return out;
  }
  function transform_position(out, a, m) {
    let x = a[0];
    let y = a[1];
    out[0] = m[0] * x + m[2] * y + m[4];
    out[1] = m[1] * x + m[3] * y + m[5];
    return out;
  }
  function distance_squared(a, b) {
    let x = b[0] - a[0];
    let y = b[1] - a[1];
    return x * x + y * y;
  }
  function lerp(out, a, b, t) {
    let ax = a[0];
    let ay = a[1];
    out[0] = ax + t * (b[0] - ax);
    out[1] = ay + t * (b[1] - ay);
    return out;
  }

  // src/components/com_local_transform2d.ts
  function local_transform2d(translation = [0, 0], scale2 = [1, 1]) {
    return (game, entity) => {
      game.World.Signature[entity] |= 1024 /* LocalTransform2D */ | 64 /* Dirty */;
      game.World.LocalTransform2D[entity] = {
        Translation: translation,
        Scale: scale2
      };
    };
  }
  function set_position(x, y) {
    return (game, entity) => {
      let local = game.World.LocalTransform2D[entity];
      local.Translation[0] = x;
      local.Translation[1] = y;
    };
  }
  function copy_position(translation) {
    return (game, entity) => {
      let local = game.World.LocalTransform2D[entity];
      copy(local.Translation, translation);
    };
  }

  // src/components/com_render2d.ts
  function render2d(tile_id, color = [1, 1, 1, 1]) {
    return (game, entity) => {
      let instance_offset = entity * FLOATS_PER_INSTANCE;
      game.World.InstanceData[instance_offset + 6] = 0;
      game.World.InstanceData[instance_offset + 7] = 8192 /* Render2D */;
      game.World.InstanceData[instance_offset + 8] = color[0];
      game.World.InstanceData[instance_offset + 9] = color[1];
      game.World.InstanceData[instance_offset + 10] = color[2];
      game.World.InstanceData[instance_offset + 11] = color[3];
      game.World.InstanceData[instance_offset + 12] = 0;
      game.World.InstanceData[instance_offset + 13] = tile_id * 17;
      game.World.Signature[entity] |= 8192 /* Render2D */;
      game.World.Render2D[entity] = {
        Color: game.World.InstanceData.subarray(instance_offset + 8, instance_offset + 12),
        Shift: 0
      };
    };
  }
  function shift(z) {
    return (game, entity) => {
      let render = game.World.Render2D[entity];
      render.Shift = z;
    };
  }
  function set_sprite(game, entity, tile_id) {
    let instance_offset = entity * FLOATS_PER_INSTANCE;
    game.World.InstanceData[instance_offset + 13] = tile_id * 17;
  }

  // maps/map_food.ts
  var map_food = { Width: 3, Height: 5, Tiles: [35, 42, 297, 53, 27, 54, 29, 45, 46, 37, 38, 39, null, 28, null] };

  // maps/map_sleep.ts
  var map_sleep = { Width: 3, Height: 3, Tiles: [21, 12, 277, 7, 8, 263, 1, 2, 257] };

  // maps/map_work.ts
  var map_work = { Width: 4, Height: 4, Tiles: [35, 43, 42, 291, 11, 41, 36, 297, 1, 11, 12, 267, null, 1, 2, 257] };

  // src/components/com_control_player.ts
  function control_player(kind) {
    return (game, entity) => {
      game.World.Signature[entity] |= 16 /* ControlPlayer */;
      game.World.ControlPlayer[entity] = {
        Kind: kind
      };
    };
  }

  // src/components/com_disable.ts
  function disable(mask) {
    return (game, entity) => {
      game.World.Signature[entity] &= ~mask;
    };
  }

  // src/components/com_generator.ts
  function generator(id) {
    return (game, entity) => {
      game.World.Signature[entity] |= 128 /* Generator */;
      game.World.Generator[entity] = {
        Id: id
      };
    };
  }

  // lib/random.ts
  var seed = 1;
  function rand() {
    seed = seed * 16807 % 2147483647;
    return (seed - 1) / 2147483646;
  }
  function integer(min = 0, max = 1) {
    return ~~(rand() * (max - min + 1) + min);
  }
  function float(min = 0, max = 1) {
    return rand() * (max - min) + min;
  }
  function element(arr) {
    return arr[integer(0, arr.length - 1)];
  }

  // src/components/com_needs.ts
  function needs() {
    return (game, entity) => {
      game.World.Signature[entity] |= 4096 /* Needs */ | 1 /* Alive */;
      game.World.Needs[entity] = {
        Value: {
          [0 /* HAPPY */]: 1,
          [2 /* FOOD */]: 1,
          [3 /* SLEEP */]: 0.7,
          [1 /* WORK */]: 1
        },
        Delta: {
          [0 /* HAPPY */]: float() / 100,
          [2 /* FOOD */]: float() / 25,
          [3 /* SLEEP */]: float() / 25,
          [1 /* WORK */]: float() / 25
        },
        Target: {
          [0 /* HAPPY */]: void 0,
          [2 /* FOOD */]: void 0,
          [3 /* SLEEP */]: void 0,
          [1 /* WORK */]: void 0
        }
      };
    };
  }

  // src/components/com_satisfy.ts
  function satisfy(type, Capacity) {
    return (game, entity) => {
      game.World.Signature[entity] |= 16384 /* Satisfy */;
      game.World.Satisfy[entity] = {
        NeedType: type,
        Capacity,
        Ocupados: []
      };
    };
  }

  // src/components/com_spatial_node2d.ts
  function spatial_node2d() {
    return (game, entity) => {
      game.World.Signature[entity] |= 32768 /* SpatialNode2D */ | 64 /* Dirty */;
      game.World.SpatialNode2D[entity] = {
        World: game.World.InstanceData.subarray(entity * FLOATS_PER_INSTANCE, entity * FLOATS_PER_INSTANCE + 6)
      };
    };
  }
  function* query_up(world, entity, mask) {
    if ((world.Signature[entity] & mask) === mask) {
      yield entity;
    }
    let parent = world.SpatialNode2D[entity].Parent;
    if (parent !== void 0) {
      yield* query_up(world, parent, mask);
    }
  }

  // src/tiled.ts
  function* tiled_blueprints(layer, width) {
    for (let i = 0; i < layer.length; i++) {
      let tile_id = layer[i];
      if (tile_id === null) {
        continue;
      }
      let x = i % width - Math.floor(width / 2);
      let y = Math.floor(i / width);
      let local;
      if (tile_id & 256 /* Horizontal */) {
        local = local_transform2d([x, y], [-1, 1]);
      } else {
        local = local_transform2d([x, y]);
      }
      tile_id &= ~256 /* Horizontal */;
      yield [tile_id, [local, render2d(tile_id)]];
    }
  }

  // src/scenes/blu_building.ts
  var building_maps = [map_sleep, map_food, map_work];
  var window_sprites = [41 /* WindowLeft */, 43 /* WindowMiddle */, 27 /* WindowRidge */];
  var needs2 = [3 /* SLEEP */, 2 /* FOOD */];
  var capacities = {
    [3 /* SLEEP */]: 7,
    [2 /* FOOD */]: 13,
    [1 /* WORK */]: 27
  };
  function blueprint_building(game, map_id) {
    let building_type = needs2[map_id] || 1 /* WORK */;
    let map = building_maps[map_id];
    let child_tiles = [];
    let light_tiles = [];
    for (let [tile_id, tile] of tiled_blueprints(map.Tiles, map.Width)) {
      child_tiles.push([spatial_node2d(), ...tile, shift(5)]);
      if (window_sprites.includes(tile_id)) {
        light_tiles.push([
          spatial_node2d(),
          ...tile,
          render2d(55 /* Blank */, [0.3, 0.3, 0.3, 1]),
          shift(-0.1)
        ]);
      }
    }
    let modifier = map.Height === 5 ? 2 : 1;
    let jezyczek = [
      spatial_node2d(),
      local_transform2d([0, -Math.round(map.Height / 2) + modifier])
    ];
    let door = [spatial_node2d(), local_transform2d([0, 0])];
    return [
      spatial_node2d(),
      local_transform2d(),
      control_player(2 /* Building */),
      satisfy(building_type, capacities[building_type]),
      generator(map_id),
      disable(128 /* Generator */ | 16384 /* Satisfy */),
      children([spatial_node2d(), local_transform2d(), children(...child_tiles)], [spatial_node2d(), local_transform2d(), children(jezyczek, door)], [spatial_node2d(), local_transform2d(), children(...light_tiles)])
    ];
  }

  // lib/color.ts
  function hsva_to_vec4(h, s, v, a) {
    let i = ~~(h * 6);
    let f = h * 6 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0:
        return [v, t, p, a];
      case 1:
        return [q, v, p, a];
      case 2:
        return [p, v, t, a];
      case 3:
        return [p, q, v, a];
      case 4:
        return [t, p, v, a];
      default:
        return [v, p, q, a];
    }
  }

  // src/components/com_control_ai.ts
  function control_ai() {
    return (game, entity) => {
      game.World.Signature[entity] |= 8 /* ControlAi */;
      game.World.ControlAi[entity] = {
        Name: random_name(integer(2, 4)) + " " + random_name(integer(2, 4)),
        Says: "Hello!",
        DecisionInterval: float(0.5, 1.5),
        TimeSinceDecision: 0
      };
    };
  }
  var consonants = "bcdfghjklmnpqrstyz";
  var vowels = "aeeaiou";
  var postfix = ["ski", "witz", "sky", "yde", "os"];
  function random_name(len) {
    let name = "";
    for (let i = 0; i < len; i++) {
      if (float() < 0.4) {
        name += element(consonants);
      } else {
        name += element(vowels);
      }
      if (i == 0) {
        name = name.toUpperCase();
      }
    }
    name += element(postfix);
    return name;
  }

  // src/components/com_lifespan.ts
  function lifespan(remaining) {
    return (game, entity) => {
      game.World.Signature[entity] |= 512 /* Lifespan */;
      game.World.Lifespan[entity] = {
        Remaining: remaining
      };
    };
  }

  // src/components/com_move2d.ts
  function move2d(move_speed) {
    return (game, entity) => {
      game.World.Signature[entity] |= 2048 /* Move2D */;
      game.World.Move2D[entity] = {
        MoveSpeed: move_speed,
        Direction: [0, 0]
      };
    };
  }

  // src/components/com_walk.ts
  function walk(speed) {
    return (game, entity) => {
      game.World.Signature[entity] |= 65536 /* Walk */;
      game.World.Walk[entity] = {
        DestinationTrigger: null,
        Path: [],
        Speed: speed
      };
    };
  }

  // src/scenes/blu_duszek.ts
  function blueprint_duszek(game) {
    return [
      local_transform2d(),
      render2d(52 /* Duszek */, hsva_to_vec4(float(0, 1), float(0.6, 0.8), float(0.6, 0.8), 1)),
      shift(1),
      control_ai(),
      walk(float(2, 2.5)),
      move2d(1),
      needs(),
      lifespan(60),
      disable(512 /* Lifespan */)
    ];
  }

  // src/scenes/blu_road.ts
  function blueprint_road(game) {
    return [local_transform2d(), render2d(34 /* RoadMiddle */)];
  }
  function blueprint_road_phantom(game) {
    return [
      local_transform2d(),
      control_player(0 /* Road */),
      render2d(34 /* RoadMiddle */),
      shift(5)
    ];
  }

  // src/scenes/blu_tree.ts
  function blueprint_tree(game) {
    return [local_transform2d(), render2d(5 /* Tree */)];
  }
  function blueprint_tree_phantom(game) {
    return [
      local_transform2d(),
      control_player(1 /* Tree */),
      render2d(5 /* Tree */),
      shift(5)
    ];
  }

  // src/store.ts
  function connect() {
    return new Promise((resolve, reject) => {
      let cx = indexedDB.open("com.piesku.duszki", 1);
      cx.onupgradeneeded = () => cx.result.createObjectStore("world", { keyPath: "id" });
      cx.onsuccess = () => resolve(cx.result);
      cx.onerror = () => reject(cx.error);
    });
  }
  function put(db, world) {
    return new Promise((resolve, reject) => {
      let store = db.transaction("world", "readwrite").objectStore("world");
      let req = store.put(world);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function get(db, id) {
    return new Promise((resolve, reject) => {
      let store = db.transaction("world", "readonly").objectStore("world");
      let req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function clear(db, id) {
    return new Promise((resolve, reject) => {
      let store = db.transaction("world", "readwrite").objectStore("world");
      let req = store.delete(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // src/actions.ts
  function dispatch(game, action, payload) {
    switch (action) {
      case 0 /* EnterPlaceRoad */: {
        document.body.classList.remove("erasing");
        let previous_phantom = first_having(game.World, 16 /* ControlPlayer */);
        if (previous_phantom !== void 0) {
          destroy_all(game.World, previous_phantom);
        }
        document.body.classList.add("building");
        instantiate(game, [
          ...blueprint_road_phantom(game),
          copy_position(game.PointerPosition)
        ]);
        break;
      }
      case 1 /* EnterPlaceTree */: {
        document.body.classList.remove("erasing");
        let previous_phantom = first_having(game.World, 16 /* ControlPlayer */);
        if (previous_phantom !== void 0) {
          destroy_all(game.World, previous_phantom);
        }
        document.body.classList.add("building");
        instantiate(game, [
          ...blueprint_tree_phantom(game),
          copy_position(game.PointerPosition)
        ]);
        break;
      }
      case 2 /* EnterPlaceBuilding */: {
        document.body.classList.remove("erasing");
        let previous_phantom = first_having(game.World, 16 /* ControlPlayer */);
        if (previous_phantom !== void 0) {
          destroy_all(game.World, previous_phantom);
        }
        document.body.classList.add("building");
        let building_id = payload;
        instantiate(game, [
          ...blueprint_building(game, building_id),
          copy_position(game.PointerPosition)
        ]);
        game.ActiveBuilding = building_id;
        break;
      }
      case 3 /* EnterErase */: {
        document.body.classList.remove("building");
        let previous_phantom = first_having(game.World, 16 /* ControlPlayer */);
        if (previous_phantom !== void 0) {
          destroy_all(game.World, previous_phantom);
        }
        document.body.classList.add("erasing");
        break;
      }
      case 4 /* SpawnDuszek */: {
        game.World.DuszkiAlive++;
        game.FrameStats.Spawns++;
        instantiate(game, [
          ...blueprint_duszek(game),
          set_position(0, Math.round(game.World.Height / 2))
        ]);
        break;
      }
      case 5 /* DuszekDied */: {
        let [entity] = payload;
        game.World.DuszkiAlive--;
        game.FrameStats.Deaths++;
        game.World.Signature[entity] &= ~(8 /* ControlAi */ | 2048 /* Move2D */ | 1 /* Alive */);
        game.World.Walk[entity].DestinationTrigger = null;
        game.World.Walk[entity].Path = [];
        set_sprite(game, entity, 22 /* Sign */);
        game.World.Render2D[entity].Shift = 0.9;
        game.World.Signature[entity] |= 512 /* Lifespan */;
        break;
      }
      case 6 /* ResetGame */: {
        if (confirm("Are you sure you want to start a new game? All progress will be lost.")) {
          clear(game.Store, game.World.id);
          location.reload();
        }
        break;
      }
      case 7 /* MinimapNavigation */: {
        let event = payload;
        let rect = game.MinimapCanvas.getBoundingClientRect();
        let scale2 = game.World.Width / rect.width;
        if (event.clientX > rect.left && event.clientX < rect.right && event.clientY > rect.top && event.clientY < rect.bottom) {
          let x = Math.floor(event.clientX - rect.left) * scale2;
          let y = Math.floor(event.clientY - rect.top) * scale2;
          let camera_entity = game.Cameras[0];
          if (camera_entity !== void 0) {
            let camera_local = game.World.LocalTransform2D[camera_entity];
            camera_local.Translation[0] = x;
            camera_local.Translation[1] = game.World.Height - y;
            game.World.Signature[camera_entity] |= 64 /* Dirty */;
          }
        }
        break;
      }
      case 8 /* ToggleMusic */: {
        let enabled = payload;
        game.MusicEnabled = enabled;
        break;
      }
    }
  }

  // lib/texture.ts
  function create_spritesheet_from(gl, image) {
    let texture = gl.createTexture();
    gl.bindTexture(GL_TEXTURE_2D, texture);
    gl.texImage2D(GL_TEXTURE_2D, 0, GL_RGBA, GL_RGBA, GL_PIXEL_UNSIGNED_BYTE, image);
    gl.texParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    gl.texParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    return texture;
  }

  // lib/material.ts
  function link(gl, vertex2, fragment2) {
    let program = gl.createProgram();
    gl.attachShader(program, compile(gl, GL_VERTEX_SHADER, vertex2));
    gl.attachShader(program, compile(gl, GL_FRAGMENT_SHADER, fragment2));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, GL_LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }
    return program;
  }
  function compile(gl, type, source) {
    let shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, GL_COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  // materials/mat_render2d.ts
  function vertex() {
    return `#version 300 es

    uniform mat3x2 pv;

    // Vertex attributes
    layout(location=${0 /* VertexPosition */}) in vec2 attr_position;
    layout(location=${1 /* VertexTexCoord */}) in vec2 attr_texcoord;

    // Instance attributes
    layout(location=${2 /* InstanceRotation */}) in vec4 attr_rotation; // [a, b, c, d]
    layout(location=${3 /* InstanceTranslation */}) in vec4 attr_translation; // [x, y, z, w: Signature]
    layout(location=${4 /* InstanceColor */}) in vec4 attr_color;
    layout(location=${5 /* InstanceSprite */}) in vec4 attr_sprite;

    out vec2 vert_texcoord;
    out vec4 vert_color;
    out vec4 vert_sprite;

    void main() {
        int signature = int(attr_translation.w);
        if ((signature & ${8192 /* Render2D */}) == ${8192 /* Render2D */}) {
            mat3x2 world = mat3x2(
                attr_rotation,
                attr_translation.xy
            );

            vec3 world_position = mat3(world) * vec3(attr_position, 1);
            vec3 clip_position = mat3(pv) * world_position;
            gl_Position = vec4(clip_position.xy, -attr_translation.z, 1);

            // attr_texcoords are +Y=down for compatibility with spritesheet frame coordinates.
            vert_texcoord = (attr_sprite.xy + vec2(16, 16) * attr_texcoord) / vec2(16, 951);
            vert_color = attr_color;
        } else {
            // Place the vertex outside the frustum.
            gl_Position.z = 2.0;
        }
    }`;
  }
  var fragment = `#version 300 es

    precision mediump float;

    uniform sampler2D sheet_texture;

    in vec2 vert_texcoord;
    in vec4 vert_color;

    out vec4 frag_color;

    void main() {
        vec4 tex_color = texture(sheet_texture, vert_texcoord);
        if (tex_color.r * tex_color.g * tex_color.b * tex_color.a == 1.0) {
            // 100% white; don't tint.
            frag_color = tex_color;
        } else {
            frag_color = vert_color * texture(sheet_texture, vert_texcoord);
            if (frag_color.a == 0.0) {
                discard;
            } else {
                // Premultiply alpha; it's used to highlight entities.
                frag_color.rgb *= frag_color.a;
            }
        }
    }
`;
  function mat_render2d(gl) {
    let program = link(gl, vertex(), fragment);
    return {
      Mode: GL_TRIANGLE_STRIP,
      Program: program,
      Locations: {
        Pv: gl.getUniformLocation(program, "pv"),
        World: gl.getUniformLocation(program, "world"),
        SheetTexture: gl.getUniformLocation(program, "sheet_texture")
      }
    };
  }

  // lib/audio.ts
  function play_note(audio, instr, note, offset, duration) {
    let time = audio.currentTime + offset;
    let total_duration = 0;
    let master = audio.createGain();
    master.gain.value = (instr[0 /* MasterGainAmount */] / 9) ** 3;
    if (instr[1 /* FilterType */]) {
      let filter = audio.createBiquadFilter();
      filter.type = instr[1 /* FilterType */];
      filter.frequency.value = 2 ** instr[2 /* FilterFreq */];
      filter.Q.value = instr[3 /* FilterQ */] ** 1.5;
      master.connect(filter);
      filter.connect(audio.destination);
    } else {
      master.connect(audio.destination);
    }
    for (let source of instr[4 /* Sources */]) {
      let amp = audio.createGain();
      amp.connect(master);
      let gain_amount = (source[1 /* GainAmount */] / 9) ** 3;
      let gain_attack = (source[2 /* GainAttack */] / 9) ** 3;
      let gain_sustain = duration;
      let gain_release = (source[4 /* GainRelease */] / 6) ** 3;
      let gain_duration = gain_attack + gain_sustain + gain_release;
      amp.gain.setValueAtTime(0, time);
      amp.gain.linearRampToValueAtTime(gain_amount, time + gain_attack);
      amp.gain.setValueAtTime(gain_amount, time + gain_attack + gain_sustain);
      amp.gain.exponentialRampToValueAtTime(1e-5, time + gain_duration);
      if (source[0]) {
        let hfo = audio.createOscillator();
        hfo.type = source[0 /* SourceType */];
        hfo.connect(amp);
        hfo.detune.value = 3 * (source[5 /* DetuneAmount */] - 7.5) ** 3;
        let freq = 440 * 2 ** ((note - 69) / 12);
        hfo.frequency.setValueAtTime(freq, time);
        hfo.start(time);
        hfo.stop(time + gain_duration);
      }
      if (gain_duration > total_duration) {
        total_duration = gain_duration;
      }
    }
  }

  // src/sounds/music1.ts
  var music1 = [
    [0, 59, 0.6],
    [0, 43, 0.5],
    [0, 31, 3.1],
    [0.12, 62, 0.2],
    [0.22, 67, 0.3],
    [1.11, 67, 0.6],
    [1.5, 59, 0.6],
    [2.24, 43, 0.3],
    [3, 59, 0.3],
    [3, 42, 0.3],
    [3.29, 59, 0.3],
    [3.29, 42, 0.8],
    [4.12, 67, 0.3],
    [4.12, 54, 0.2],
    [4.12, 42, 0.3],
    [4.34, 35, 0.1],
    [4.48, 35, 0.8],
    [4.5, 62, 0.6],
    [4.5, 59, 0.5],
    [4.5, 55, 0.6],
    [4.5, 47, 0.6],
    [4.5, 43, 0.8],
    [5.26, 43, 0.7],
    [5.62, 62, 0.3],
    [5.96, 33, 0.6],
    [5.99, 67, 0.3],
    [5.99, 64, 0.5],
    [5.99, 60, 0.6],
    [5.99, 45, 0.2],
    [6.56, 33, 2.1],
    [7.13, 67, 0.4],
    [7.5, 60, 0.6],
    [8.62, 33, 0.3],
    [9, 62, 0.4],
    [9, 60, 0.6],
    [9, 57, 0.7],
    [9, 50, 0.8],
    [9, 38, 0.5],
    [9.03, 66, 0.4],
    [9.76, 50, 0.4],
    [10.12, 50, 0.4],
    [10.13, 69, 0.3],
    [10.13, 62, 0.4],
    [10.29, 38, 0.2],
    [10.49, 38, 0.7],
    [10.5, 66, 0.5],
    [10.5, 60, 0.5],
    [10.5, 57, 0.7],
    [11.05, 42, 0.6],
    [11.24, 66, 0.6],
    [11.64, 33, 0.3],
    [11.99, 59, 0.6],
    [11.99, 43, 0.5],
    [12, 62, 0.3],
    [12.01, 31, 2.4],
    [13.13, 67, 0.6],
    [13.51, 59, 0.7],
    [14.24, 62, 0.6],
    [14.24, 59, 0.7],
    [14.24, 55, 0.4],
    [14.24, 43, 0.4],
    [14.63, 43, 0.4],
    [15, 66, 0.6],
    [15.01, 62, 0.6],
    [15.01, 59, 0.6],
    [15.01, 42, 1.2],
    [16.11, 71, 0.3],
    [16.16, 42, 0.3],
    [16.5, 62, 0.7],
    [16.5, 59, 0.4],
    [16.5, 47, 0.7],
    [16.51, 55, 0.5],
    [16.51, 43, 0.2],
    [16.51, 35, 0.6],
    [16.73, 43, 0.2],
    [16.88, 43, 0.8],
    [17.07, 31, 0.5],
    [17.6, 31, 0.3],
    [17.62, 62, 0.3],
    [17.98, 67, 0.5],
    [17.98, 45, 0.2],
    [18, 64, 0.6],
    [18.02, 69, 0.5],
    [18.04, 33, 2.6],
    [19.12, 69, 0.6],
    [19.51, 64, 0.5],
    [20.52, 28, 0.5],
    [20.99, 50, 0.3],
    [21, 62, 0.5],
    [21, 38, 1.1],
    [21, 66, 0.8],
    [21.12, 60, 0.4],
    [22.12, 72, 0.3],
    [22.12, 66, 0.4],
    [22.12, 38, 0.4],
    [22.49, 66, 0.5],
    [22.49, 60, 0.6],
    [22.5, 57, 0.7],
    [22.5, 38, 0.7],
    [23.05, 33, 0.6],
    [23.26, 66, 0.5],
    [23.62, 42, 0.4],
    [23.98, 40, 0.5],
    [23.99, 59, 0.6],
    [23.99, 55, 0.7],
    [24.02, 64, 0.6],
    [24.04, 28, 2.9],
    [25.12, 67, 0.5],
    [25.5, 59, 0.6],
    [26.28, 64, 0.2],
    [26.98, 33, 1.2],
    [27, 64, 0.4],
    [27, 61, 0.6],
    [27, 52, 0.2],
    [27, 45, 0.2],
    [27.06, 67, 0.4],
    [28.11, 57, 0.5],
    [28.13, 69, 0.3],
    [28.13, 45, 0.2],
    [28.13, 33, 0.4],
    [28.52, 33, 0.7],
    [29.24, 40, 0.7],
    [29.26, 57, 0.3],
    [29.64, 64, 0.3],
    [30, 57, 0.7],
    [30, 38, 1.5],
    [30.01, 61, 0.6],
    [31.12, 66, 0.5],
    [31.51, 61, 0.6],
    [31.51, 38, 1.1],
    [32.27, 62, 0.2],
    [32.62, 66, 0.4],
    [32.63, 38, 0.4],
    [32.99, 38, 0.2],
    [32.99, 31, 1.5],
    [33, 66, 0.6],
    [33, 59, 0.6],
    [33, 43, 0.2],
    [34.12, 67, 0.3],
    [34.12, 62, 0.4],
    [34.49, 43, 0.5],
    [34.49, 31, 0.7],
    [35.06, 35, 0.6],
    [35.25, 66, 0.5],
    [35.62, 38, 0.3],
    [35.99, 64, 0.3],
    [35.99, 59, 0.5],
    [35.99, 55, 0.7],
    [35.99, 40, 0.4],
    [36, 28, 1.7],
    [36.41, 64, 0.3],
    [37.12, 67, 0.5],
    [37.5, 59, 0.5],
    [37.73, 28, 1.2],
    [38.3, 64, 0.2],
    [39, 62, 0.5],
    [39, 57, 0.3],
    [39, 45, 0.4],
    [39, 33, 1],
    [39.76, 52, 0.3],
    [39.98, 33, 0.5],
    [40.11, 74, 0.3],
    [40.49, 45, 0.5],
    [40.5, 64, 0.6],
    [40.5, 61, 0.7],
    [40.5, 33, 0.5],
    [40.86, 37, 0.2],
    [41.01, 45, 0.2],
    [41.01, 37, 0.6],
    [41.3, 57, 0.2],
    [41.47, 28, 0.5],
    [41.62, 64, 0.4],
    [41.99, 36, 1.5],
    [42, 64, 0.9],
    [42, 60, 0.5],
    [42, 55, 0.7],
    [43.12, 67, 0.5],
    [43.51, 60, 0.6],
    [43.52, 36, 0.7],
    [44.24, 60, 0.8],
    [44.25, 64, 0.6],
    [44.25, 55, 0.6],
    [44.26, 35, 0.6],
    [44.56, 31, 0.4],
    [44.98, 33, 1.5],
    [45.01, 64, 0.6],
    [45.01, 60, 0.6],
    [45.01, 57, 0.6],
    [45.01, 45, 0.5],
    [46.12, 64, 0.3],
    [46.13, 72, 0.3],
    [46.48, 38, 0.7],
    [46.5, 57, 0.6],
    [46.5, 54, 1],
    [47.05, 33, 0.6],
    [47.25, 66, 0.4]
  ];

  // src/systems/sys_audio_source.ts
  var music = music1;
  var prev_time = 0;
  var curr_time = 0;
  var note_index = 0;
  var instrument = [
    2,
    false,
    8,
    0,
    [
      ["triangle", 8, 2, 2, 4, 8, false],
      ["sine", 4, 3, 3, 5, 9, false]
    ]
  ];
  function sys_audio_source(game, delta) {
    prev_time = curr_time;
    curr_time += delta;
    while (note_index < music.length) {
      let [time, note, duration] = music[note_index];
      if (time > curr_time) {
        return;
      }
      play_note(game.Audio, instrument, note, time - prev_time, duration);
      note_index++;
    }
    note_index = 0;
    curr_time = 0;
  }

  // lib/input.ts
  function pointer_down(game, mouse_button) {
    return game.InputState["Mouse" + mouse_button] > 0;
  }
  function pointer_clicked(game, mouse_button) {
    return game.InputDelta["Mouse" + mouse_button] === -1 && game.InputDistance["Mouse" + mouse_button] < 5;
  }
  function pointer_viewport(game, out) {
    if (game.InputDistance["Mouse"] > 0) {
      out[0] = game.InputState["MouseX"];
      out[1] = game.InputState["MouseY"];
      return true;
    }
    return false;
  }

  // lib/mat2d.ts
  function create() {
    return [1, 0, 0, 1, 0, 0];
  }
  function set2(out, a, b, c, d, tx, ty) {
    out[0] = a;
    out[1] = b;
    out[2] = c;
    out[3] = d;
    out[4] = tx;
    out[5] = ty;
    return out;
  }
  function copy2(out, a) {
    set2(out, a[0], a[1], a[2], a[3], a[4], a[5]);
    return out;
  }
  function invert(out, a) {
    let aa = a[0], ab = a[1], ac = a[2], ad = a[3];
    let atx = a[4], aty = a[5];
    let det = aa * ad - ab * ac;
    if (!det) {
      return null;
    }
    det = 1 / det;
    out[0] = ad * det;
    out[1] = -ab * det;
    out[2] = -ac * det;
    out[3] = aa * det;
    out[4] = (ac * aty - ad * atx) * det;
    out[5] = (ab * atx - aa * aty) * det;
    return out;
  }
  function multiply(out, a, b) {
    let a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], a4 = a[4], a5 = a[5];
    let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3], b4 = b[4], b5 = b[5];
    out[0] = a0 * b0 + a2 * b1;
    out[1] = a1 * b0 + a3 * b1;
    out[2] = a0 * b2 + a2 * b3;
    out[3] = a1 * b2 + a3 * b3;
    out[4] = a0 * b4 + a2 * b5 + a4;
    out[5] = a1 * b4 + a3 * b5 + a5;
    return out;
  }
  function get_translation(out, a) {
    out[0] = a[4];
    out[1] = a[5];
    return out;
  }
  function from_ortho(out, left, top) {
    set2(out, 1 / left, 0, 0, 1 / top, 0, 0);
    return out;
  }

  // src/config.ts
  var GENERATORS = [
    {
      Name: "Cemetery",
      Description: "Where duszki can rest.",
      BaseIncome: 0,
      IncomeFactor: 1,
      StartingCost: 20,
      CostFactor: 1.4
    },
    {
      Name: "Chapel",
      Description: "Where duszki can eat.",
      BaseIncome: 0,
      IncomeFactor: 1,
      StartingCost: 15,
      CostFactor: 1.5
    },
    {
      Name: "Crypt",
      Description: "Where duszki can work.",
      BaseIncome: 0.2,
      IncomeFactor: 1.01,
      StartingCost: 40,
      CostFactor: 1.6
    }
  ];

  // src/generator.ts
  function total_cost(gen, own_count) {
    return gen.StartingCost * gen.CostFactor ** own_count;
  }
  function income(gen, count) {
    return gen.BaseIncome * count ** gen.IncomeFactor;
  }

  // src/systems/sys_build_roads.ts
  var QUERY = 16 /* ControlPlayer */ | 1024 /* LocalTransform2D */;
  var ROAD_UPDATE_WALKS_THRESHOLD = 100;
  function sys_build_roads(game, delta) {
    let road_placed = false;
    for (let ent = 0; ent < game.World.Signature.length; ent++) {
      if ((game.World.Signature[ent] & QUERY) == QUERY) {
        let control = game.World.ControlPlayer[ent];
        if (control.Kind !== 0 /* Road */) {
          continue;
        }
        let local = game.World.LocalTransform2D[ent];
        let x = Math.round(local.Translation[0]);
        let y = Math.round(local.Translation[1]);
        let can_be_placed = false;
        let cell = game.World.Grid[y]?.[x];
        if (cell && cell.TileEntity === null) {
          can_be_placed = true;
        }
        let render = game.World.Render2D[ent];
        render.Color[0] = can_be_placed ? 0 : 1;
        render.Color[1] = can_be_placed ? 1 : 0;
        render.Color[2] = 0;
        if (can_be_placed && pointer_down(game, 0)) {
          game.World.Signature[ent] &= ~16 /* ControlPlayer */;
          road_placed = true;
          cell.TileEntity = ent;
          cell.Walkable = true;
          cell.Pleasant = false;
          cell.Type = 1 /* Road */;
          cell.TimesWalked = 0;
          cell.Updated = false;
          make_tiled_road(game, x, y);
          render.Color[0] = 1;
          render.Color[1] = 1;
          render.Color[2] = 1;
          render.Shift = 0;
        } else if (pointer_clicked(game, 2)) {
          document.body.classList.remove("building");
          destroy_all(game.World, ent);
        }
      }
    }
    if (road_placed) {
      let x = Math.round(game.PointerPosition[0]);
      let y = Math.round(game.PointerPosition[1]);
      instantiate(game, [...blueprint_road_phantom(game), set_position(x, y)]);
    }
  }
  function make_tiled_road(game, x, y) {
    choose_tile_based_on_neighbors(game, x, y);
    if (game.World.Grid[y + 1]?.[x].Walkable) {
      choose_tile_based_on_neighbors(game, x, y + 1);
    }
    if (game.World.Grid[y][x + 1]?.Walkable) {
      choose_tile_based_on_neighbors(game, x + 1, y);
    }
    if (game.World.Grid[y - 1]?.[x].Walkable) {
      choose_tile_based_on_neighbors(game, x, y - 1);
    }
    if (game.World.Grid[y][x - 1]?.Walkable) {
      choose_tile_based_on_neighbors(game, x - 1, y);
    }
  }
  var RoadNeighborSprites = {
    [0]: 34 /* RoadMiddle */,
    [8 /* UP */]: 40 /* RoadTopDown */,
    [8 /* UP */ | 4 /* RIGHT */]: 30 /* RoadRightDown */,
    [8 /* UP */ | 4 /* RIGHT */ | 1 /* LEFT */]: 33 /* RoadLeftRightDown */,
    [8 /* UP */ | 4 /* RIGHT */ | 1 /* LEFT */ | 2 /* DOWN */]: 34 /* RoadMiddle */,
    [8 /* UP */ | 4 /* RIGHT */ | 2 /* DOWN */]: 32 /* RoadTopRightDown */,
    [8 /* UP */ | 1 /* LEFT */]: 30 /* RoadRightDown */,
    [8 /* UP */ | 1 /* LEFT */ | 2 /* DOWN */]: 32 /* RoadTopRightDown */,
    [8 /* UP */ | 2 /* DOWN */]: 40 /* RoadTopDown */,
    [4 /* RIGHT */]: 31 /* RoadLeftRight */,
    [4 /* RIGHT */ | 1 /* LEFT */]: 31 /* RoadLeftRight */,
    [4 /* RIGHT */ | 1 /* LEFT */ | 2 /* DOWN */]: 33 /* RoadLeftRightDown */,
    [4 /* RIGHT */ | 2 /* DOWN */]: 30 /* RoadRightDown */,
    [2 /* DOWN */]: 40 /* RoadTopDown */,
    [1 /* LEFT */]: 31 /* RoadLeftRight */,
    [1 /* LEFT */ | 2 /* DOWN */]: 30 /* RoadRightDown */
  };
  function choose_tile_based_on_neighbors(game, x, y) {
    let tile = game.World.Grid[y][x].TileEntity;
    let type = game.World.Grid[y][x].Type;
    let timesWalked = game.World.Grid[y][x].TimesWalked;
    if (!tile || type == 0 /* Other */) {
      return;
    }
    let local = game.World.LocalTransform2D[tile];
    set(local.Scale, 1, 1);
    game.World.Signature[tile] |= 64 /* Dirty */;
    let neighbors = 0;
    if (game.World.Grid[y + 1]?.[x].Walkable) {
      neighbors |= 8 /* UP */;
      local.Scale[1] = -1;
    }
    if (game.World.Grid[y][x + 1]?.Walkable) {
      neighbors |= 4 /* RIGHT */;
    }
    if (game.World.Grid[y - 1]?.[x].Walkable) {
      neighbors |= 2 /* DOWN */;
    }
    if (game.World.Grid[y][x - 1]?.Walkable) {
      neighbors |= 1 /* LEFT */;
      local.Scale[0] = -1;
    }
    let sprite = RoadNeighborSprites[neighbors];
    if (timesWalked > ROAD_UPDATE_WALKS_THRESHOLD) {
      sprite = sprite - 14;
    }
    set_sprite(game, tile, sprite);
  }

  // src/systems/sys_build_buildings.ts
  var QUERY2 = 16 /* ControlPlayer */ | 1024 /* LocalTransform2D */;
  var world_position = [0, 0];
  function sys_build_buildings(game, delta) {
    let building_placed = false;
    for (let ent = 0; ent < game.World.Signature.length; ent++) {
      if ((game.World.Signature[ent] & QUERY2) == QUERY2) {
        let control = game.World.ControlPlayer[ent];
        if (control.Kind !== 2 /* Building */) {
          continue;
        }
        let children2 = game.World.Children[ent].Children;
        let tiles_container = children2[0 /* Tiles */];
        let can_be_placed = true;
        for (let child_entity of query_down(game.World, tiles_container, 8192 /* Render2D */)) {
          let render = game.World.Render2D[child_entity];
          let local = game.World.LocalTransform2D[child_entity];
          let spatial = game.World.SpatialNode2D[child_entity];
          let x = Math.round(spatial.World[4]);
          let y = Math.round(spatial.World[5]);
          let cell = game.World.Grid[y]?.[x];
          if (local.Translation[1] > 3 || cell && cell.TileEntity === null) {
            render.Color[0] = 0;
            render.Color[1] = 1;
            render.Color[2] = 0;
          } else {
            can_be_placed = false;
            render.Color[0] = 1;
            render.Color[1] = 0;
            render.Color[2] = 0;
          }
        }
        let generator2 = game.World.Generator[ent];
        let gen_config = GENERATORS[generator2.Id];
        let gen_count = game.GeneratorCounts[generator2.Id];
        let cost = total_cost(gen_config, gen_count);
        if (can_be_placed && cost <= game.World.TotalWealth && pointer_clicked(game, 0)) {
          game.World.TotalWealth -= cost;
          game.World.Signature[ent] &= ~16 /* ControlPlayer */;
          game.World.Signature[ent] |= 128 /* Generator */ | 16384 /* Satisfy */;
          building_placed = true;
          for (let child_entity of query_down(game.World, tiles_container, 8192 /* Render2D */)) {
            let local = game.World.LocalTransform2D[child_entity];
            let spatial = game.World.SpatialNode2D[child_entity];
            get_translation(world_position, spatial.World);
            let x = Math.round(world_position[0]);
            let y = Math.round(world_position[1]);
            if (local.Translation[1] > 3) {
            } else {
              let cell = game.World.Grid[y]?.[x];
              cell.TileEntity = child_entity;
              cell.Walkable = false;
              cell.Pleasant = false;
            }
            let render = game.World.Render2D[child_entity];
            render.Color[0] = 1;
            render.Color[1] = 1;
            render.Color[2] = 1;
            render.Shift = 0;
          }
          let buildingSatisfierEntities = children2[1 /* Satisfier */];
          let door = game.World.Children[buildingSatisfierEntities]?.Children[1 /* Door */];
          let door_spatial = game.World.SpatialNode2D[door];
          let door_local = get_translation([0, 0], door_spatial.World);
          let door_x = Math.round(door_local[0]);
          let door_y = Math.round(door_local[1]);
          let door_cell = game.World.Grid[door_y]?.[door_x];
          door_cell.Walkable = true;
          make_tiled_road(game, door_x, door_y);
        } else if (pointer_clicked(game, 2)) {
          document.body.classList.remove("building");
          destroy_all(game.World, ent);
        }
      }
    }
    if (building_placed && game.ActiveBuilding !== null) {
      instantiate(game, [
        ...blueprint_building(game, game.ActiveBuilding),
        set_position(Math.round(game.PointerPosition[0]), Math.round(game.PointerPosition[1]))
      ]);
    }
  }

  // src/systems/sys_build_trees.ts
  var QUERY3 = 16 /* ControlPlayer */ | 1024 /* LocalTransform2D */;
  function sys_build_trees(game, delta) {
    let tree_placed = false;
    for (let ent = 0; ent < game.World.Signature.length; ent++) {
      if ((game.World.Signature[ent] & QUERY3) == QUERY3) {
        let control = game.World.ControlPlayer[ent];
        if (control.Kind !== 1 /* Tree */) {
          continue;
        }
        let local = game.World.LocalTransform2D[ent];
        let x = Math.round(local.Translation[0]);
        let y = Math.round(local.Translation[1]);
        let can_be_placed = false;
        let cell = game.World.Grid[y]?.[x];
        if (cell && cell.TileEntity === null) {
          can_be_placed = true;
        }
        let render = game.World.Render2D[ent];
        render.Color[0] = can_be_placed ? 0 : 1;
        render.Color[1] = can_be_placed ? 1 : 0;
        render.Color[2] = 0;
        if (can_be_placed && pointer_down(game, 0)) {
          game.World.Signature[ent] &= ~16 /* ControlPlayer */;
          tree_placed = true;
          cell.TileEntity = ent;
          cell.Walkable = false;
          cell.Pleasant = true;
          cell.Type = 2 /* Tree */;
          make_tiled_park(game, x, y);
          render.Color[0] = 1;
          render.Color[1] = 1;
          render.Color[2] = 1;
          render.Shift = 0;
        } else if (pointer_clicked(game, 2)) {
          document.body.classList.remove("building");
          destroy_all(game.World, ent);
        }
      }
    }
    if (tree_placed) {
      let x = Math.round(game.PointerPosition[0]);
      let y = Math.round(game.PointerPosition[1]);
      instantiate(game, [...blueprint_tree_phantom(game), set_position(x, y)]);
    }
  }
  function make_tiled_park(game, x, y) {
    choose_tile_based_on_neighbors2(game, x, y);
    if (game.World.Grid[y + 1]?.[x].Pleasant) {
      choose_tile_based_on_neighbors2(game, x, y + 1);
    }
    if (game.World.Grid[y][x + 1]?.Pleasant) {
      choose_tile_based_on_neighbors2(game, x + 1, y);
    }
    if (game.World.Grid[y - 1]?.[x].Pleasant) {
      choose_tile_based_on_neighbors2(game, x, y - 1);
    }
    if (game.World.Grid[y][x - 1]?.Pleasant) {
      choose_tile_based_on_neighbors2(game, x - 1, y);
    }
  }
  var TreesNeighborSprites = {
    [0]: 5 /* Tree */,
    [8 /* UP */]: 14 /* TreeTop */,
    [8 /* UP */ | 4 /* RIGHT */]: 13 /* TreeTopRight */,
    [8 /* UP */ | 4 /* RIGHT */ | 1 /* LEFT */]: 51 /* TreeTopLeftRight */,
    [8 /* UP */ | 4 /* RIGHT */ | 1 /* LEFT */ | 2 /* DOWN */]: 10 /* TreeMiddle */,
    [8 /* UP */ | 4 /* RIGHT */ | 2 /* DOWN */]: 49 /* TreeTopRightDown */,
    [8 /* UP */ | 1 /* LEFT */]: 13 /* TreeTopRight */,
    [8 /* UP */ | 1 /* LEFT */ | 2 /* DOWN */]: 49 /* TreeTopRightDown */,
    [8 /* UP */ | 2 /* DOWN */]: 48 /* TreeTopDown */,
    [4 /* RIGHT */]: 9 /* TreeRight */,
    [4 /* RIGHT */ | 1 /* LEFT */]: 47 /* TreeLeftRight */,
    [4 /* RIGHT */ | 1 /* LEFT */ | 2 /* DOWN */]: 50 /* TreeLeftRightDown */,
    [4 /* RIGHT */ | 2 /* DOWN */]: 3 /* TreeRightDown */,
    [2 /* DOWN */]: 4 /* TreeDown */,
    [1 /* LEFT */]: 9 /* TreeRight */,
    [1 /* LEFT */ | 2 /* DOWN */]: 3 /* TreeRightDown */
  };
  function choose_tile_based_on_neighbors2(game, x, y) {
    let tile = game.World.Grid[y][x].TileEntity;
    let type = game.World.Grid[y][x].Type;
    if (!tile || type == 0 /* Other */) {
      return;
    }
    let local = game.World.LocalTransform2D[tile];
    set(local.Scale, 1, 1);
    game.World.Signature[tile] |= 64 /* Dirty */;
    let neighbors = 0;
    if (game.World.Grid[y + 1]?.[x].Pleasant) {
      neighbors |= 8 /* UP */;
    }
    if (game.World.Grid[y][x + 1]?.Pleasant) {
      neighbors |= 4 /* RIGHT */;
    }
    if (game.World.Grid[y - 1]?.[x].Pleasant) {
      neighbors |= 2 /* DOWN */;
    }
    if (game.World.Grid[y][x - 1]?.Pleasant) {
      neighbors |= 1 /* LEFT */;
      local.Scale[0] = -1;
    }
    set_sprite(game, tile, TreesNeighborSprites[neighbors]);
  }

  // src/scenes/blu_grave.ts
  var GraveSprites = [23 /* Tombstone1 */, 24 /* Tombstone2 */];
  function blueprint_grave(game, xy) {
    return [local_transform2d(), render2d(GraveSprites[xy % GraveSprites.length]), shift(0.1)];
  }

  // src/systems/sys_satisfy.ts
  var QUERY4 = 16384 /* Satisfy */;
  function sys_satisfy(game, delta) {
    for (let ent = 0; ent < game.World.Signature.length; ent++) {
      if ((game.World.Signature[ent] & QUERY4) == QUERY4) {
        update(game, ent, delta);
      }
    }
  }
  var BEING_SATISFIED_MASK = 8192 /* Render2D */ | 65536 /* Walk */ | 1 /* Alive */;
  var WORKING_MASK = 8192 /* Render2D */ | 65536 /* Walk */;
  var SATISFY_THRESHOLD = 0.75;
  var LOW_SATISFY_THRESHOLD = 0.4;
  var world_position2 = [0, 0];
  function update(game, entity, delta) {
    let satisfy2 = game.World.Satisfy[entity];
    let children2 = game.World.Children[entity].Children;
    let buildingSatisfierEntities = children2[1 /* Satisfier */];
    let jezyczek = game.World.Children[buildingSatisfierEntities]?.Children[0 /* Jezyczek */];
    let door = game.World.Children[buildingSatisfierEntities]?.Children[1 /* Door */];
    let jezyczek_spatial = game.World.SpatialNode2D[jezyczek];
    get_translation(world_position2, jezyczek_spatial.World);
    let jezyczek_x = Math.round(world_position2[0]);
    let jezyczek_y = Math.round(world_position2[1]);
    let jezyczek_cell = game.World.Grid[jezyczek_y]?.[jezyczek_x];
    if (!jezyczek_cell) {
      return;
    }
    if (satisfy2.Ocupados.length < satisfy2.Capacity) {
      let guests_on_jezyczek = jezyczek_cell.Ocupados;
      for (let guest of guests_on_jezyczek) {
        let need = game.World.Needs[guest];
        need.Target[satisfy2.NeedType] = entity;
      }
    }
    let door_spatial = game.World.SpatialNode2D[door];
    get_translation(world_position2, door_spatial.World);
    let door_x = Math.round(world_position2[0]);
    let door_y = Math.round(world_position2[1]);
    let door_cell = game.World.Grid[door_y]?.[door_x];
    if (!door_cell) {
      return;
    }
    let guests_on_door = door_cell.Ocupados;
    for (let guest of guests_on_door) {
      let need = game.World.Needs[guest];
      let walk2 = game.World.Walk[guest];
      if (need && satisfy2.NeedType === 1 /* WORK */) {
        if (need.Value[2 /* FOOD */] > SATISFY_THRESHOLD && need.Value[3 /* SLEEP */] > SATISFY_THRESHOLD) {
          if (satisfy2.Ocupados.length <= satisfy2.Capacity) {
            satisfy2.Ocupados.push(guest);
            game.World.Signature[guest] &= ~WORKING_MASK;
            game.World.DuszkiWorking++;
            need.Target[satisfy2.NeedType] = entity;
            walk2.Path = [];
            walk2.DestinationTrigger = null;
          } else if (entity === need.Target[satisfy2.NeedType]) {
            need.Target[satisfy2.NeedType] = void 0;
          }
        }
      } else if (need && need.Value[satisfy2.NeedType] < SATISFY_THRESHOLD) {
        if (satisfy2.Ocupados.length < satisfy2.Capacity) {
          satisfy2.Ocupados.push(guest);
          game.World.Signature[guest] &= ~BEING_SATISFIED_MASK;
          need.Target[satisfy2.NeedType] = entity;
          walk2.Path = [];
          walk2.DestinationTrigger = null;
          if (satisfy2.NeedType === 3 /* SLEEP */) {
            let tile_entities = game.World.Children[entity].Children[0 /* Tiles */];
            let tiles = game.World.Children[tile_entities].Children;
            let x = integer(-2, 1);
            let y = integer(1, 2);
            let grave = instantiate(game, [
              spatial_node2d(),
              ...blueprint_grave(game, x + y),
              set_position(x, y)
            ]);
            tiles.push(grave);
            game.World.Signature[tile_entities] |= 64 /* Dirty */;
          }
        } else if (entity === need.Target[satisfy2.NeedType]) {
          need.Target[satisfy2.NeedType] = void 0;
        }
      }
    }
    for (let guest of satisfy2.Ocupados) {
      let need = game.World.Needs[guest];
      if (satisfy2.NeedType === 1 /* WORK */) {
        if (need.Value[2 /* FOOD */] < LOW_SATISFY_THRESHOLD || need.Value[3 /* SLEEP */] < LOW_SATISFY_THRESHOLD) {
          satisfy2.Ocupados.splice(satisfy2.Ocupados.indexOf(guest), 1);
          game.World.Signature[guest] |= WORKING_MASK;
          game.World.DuszkiWorking--;
        }
      } else {
        need.Value[satisfy2.NeedType] += need.Delta[satisfy2.NeedType] * delta * 4;
        if (need.Value[satisfy2.NeedType] >= 1) {
          satisfy2.Ocupados.splice(satisfy2.Ocupados.indexOf(guest), 1);
          game.World.Signature[guest] |= BEING_SATISFIED_MASK;
          if (satisfy2.NeedType === 3 /* SLEEP */) {
            let tile_entities = game.World.Children[entity].Children[0 /* Tiles */];
            let tiles = game.World.Children[tile_entities].Children;
            let grave = tiles[9];
            tiles.splice(9, 1);
            destroy_all(game.World, grave);
          }
        }
      }
    }
    let lights_container = children2[2 /* Lights */];
    for (let child_entity of query_down(game.World, lights_container, 8192 /* Render2D */)) {
      let render = game.World.Render2D[child_entity];
      if (satisfy2.Ocupados.length > 0) {
        render.Color[0] = 1;
        render.Color[1] = 1;
        render.Color[2] = 0;
      } else {
        render.Color[0] = 0.3;
        render.Color[1] = 0.3;
        render.Color[2] = 0.3;
      }
    }
  }

  // src/systems/sys_build_erase.ts
  var world_position3 = [0, 0];
  function sys_build_erase(game, delta) {
    if (document.body.classList.contains("erasing")) {
      let x = Math.round(game.PointerPosition[0]);
      let y = Math.round(game.PointerPosition[1]);
      let cell = game.World.Grid[y]?.[x];
      if (cell && cell.TileEntity !== null) {
        let render = game.World.Render2D[cell.TileEntity];
        render.Color[0] = 0.2;
        render.Color[1] = 0.2;
        render.Color[2] = 0.2;
        if (pointer_down(game, 0)) {
          if (game.World.Signature[cell.TileEntity] & 32768 /* SpatialNode2D */) {
            let root_entity;
            for (let parent_entity of query_up(game.World, cell.TileEntity, 128 /* Generator */)) {
              root_entity = parent_entity;
              break;
            }
            if (root_entity === void 0) {
              destroy_all(game.World, cell.TileEntity);
            } else {
              let generator2 = game.World.Generator[root_entity];
              let reimbursed = total_cost(GENERATORS[generator2.Id], game.GeneratorCounts[generator2.Id] - 1);
              game.World.TotalWealth += reimbursed;
              let satisfy2 = game.World.Satisfy[root_entity];
              let children2 = game.World.Children[root_entity].Children;
              let satisfier_entities = children2[1 /* Satisfier */];
              let jezyczek_entity = game.World.Children[satisfier_entities].Children[0 /* Jezyczek */];
              let jezyczek_spatial = game.World.SpatialNode2D[jezyczek_entity];
              get_translation(world_position3, jezyczek_spatial.World);
              let jezyczek_x = Math.round(world_position3[0]);
              let jezyczek_y = Math.round(world_position3[1]);
              let jezyczek_cell = game.World.Grid[jezyczek_y]?.[jezyczek_x];
              if (jezyczek_cell) {
                for (let ocupado of satisfy2.Ocupados) {
                  game.World.Signature[ocupado] |= BEING_SATISFIED_MASK;
                  let walk2 = game.World.Walk[ocupado];
                  walk2.Path = [jezyczek_cell];
                }
              }
              for (let child_entity of query_down(game.World, root_entity, 8192 /* Render2D */)) {
                let child_spatial = game.World.SpatialNode2D[child_entity];
                get_translation(world_position3, child_spatial.World);
                let x2 = Math.round(world_position3[0]);
                let y2 = Math.round(world_position3[1]);
                let cell2 = game.World.Grid[y2][x2];
                cell2.Walkable = false;
                cell2.TileEntity = null;
              }
              destroy_all(game.World, root_entity);
            }
          } else {
            destroy_all(game.World, cell.TileEntity);
          }
          cell.TileEntity = null;
          cell.Walkable = false;
          cell.Pleasant = false;
          cell.Ocupados = [];
          cell.Type = 0 /* Other */;
          make_tiled_road(game, x, y);
          make_tiled_park(game, x, y);
        }
      } else if (pointer_clicked(game, 2)) {
        document.body.classList.remove("erasing");
      }
    }
  }

  // src/systems/sys_camera2d.ts
  var QUERY5 = 32768 /* SpatialNode2D */ | 2 /* Camera2D */;
  function sys_camera2d(game, delta) {
    game.Cameras = [];
    for (let ent = 0; ent < game.World.Signature.length; ent++) {
      if ((game.World.Signature[ent] & QUERY5) === QUERY5) {
        let camera = game.World.Camera2D[ent];
        let camera_node = game.World.SpatialNode2D[ent];
        invert(camera.Pv, camera_node.World);
        multiply(camera.Pv, camera.Projection.Projection, camera.Pv);
        copy2(camera.World, camera_node.World);
        game.Cameras.push(ent);
      }
    }
  }

  // src/systems/sys_control_ai.ts
  var QUERY6 = 8 /* ControlAi */ | 65536 /* Walk */ | 4096 /* Needs */ | 2048 /* Move2D */;
  var walkables = [];
  function sys_control_ai(game, delta) {
    walkables = [];
    for (let y = 0; y < game.World.Grid.length; y++) {
      for (let x = 0; x < game.World.Grid[y].length; x++) {
        if (game.World.Grid[y][x].Walkable) {
          walkables.push(game.World.Grid[y][x]);
        }
      }
    }
    for (let ent = 0; ent < game.World.Signature.length; ent++) {
      if ((game.World.Signature[ent] & QUERY6) == QUERY6) {
        update2(game, ent, delta);
      }
    }
  }
  var destination_position = [0, 0];
  function update2(game, entity, delta) {
    let walk2 = game.World.Walk[entity];
    let move = game.World.Move2D[entity];
    let needs3 = game.World.Needs[entity];
    let control = game.World.ControlAi[entity];
    move.MoveSpeed = walk2.Speed * needs3.Value[0 /* HAPPY */];
    if (needs3.Value[2 /* FOOD */] < 1e-3) {
      dispatch(game, 5 /* DuszekDied */, [entity]);
      return;
    }
    if (needs3.Value[3 /* SLEEP */] < 1e-3) {
      dispatch(game, 5 /* DuszekDied */, [entity]);
      return;
    }
    if (walk2.DestinationTrigger !== null) {
      let tile_entity = walk2.DestinationTrigger.TileEntity;
      if (tile_entity !== null) {
        for (let parent_entity of query_up(game.World, tile_entity, 16384 /* Satisfy */)) {
          let satisfy2 = game.World.Satisfy[parent_entity];
          needs3.Target[satisfy2.NeedType] = void 0;
          break;
        }
      }
      walk2.DestinationTrigger = null;
    }
    control.TimeSinceDecision += delta;
    if (control.TimeSinceDecision > control.DecisionInterval) {
      let current_destination = walk2.Path[walk2.Path.length - 1];
      if (needs3.Value[2 /* FOOD */] < SATISFY_THRESHOLD && needs3.Value[2 /* FOOD */] < needs3.Value[3 /* SLEEP */]) {
        control.Says = "I'm hungry!";
        let food_target = needs3.Target[2 /* FOOD */];
        if (food_target && game.World.Signature[food_target] & 16384 /* Satisfy */ && game.World.Satisfy[food_target].NeedType === 2 /* FOOD */) {
          let target_spatial = game.World.SpatialNode2D[food_target];
          get_translation(destination_position, target_spatial.World);
          let x = Math.round(destination_position[0]);
          let y = Math.round(destination_position[1]);
          let cell = game.World.Grid[y][x];
          if (current_destination === void 0) {
            walk2.DestinationTrigger = cell;
            control.TimeSinceDecision = 0;
          } else if (cell !== current_destination && needs3.Value[2 /* FOOD */] < LOW_SATISFY_THRESHOLD) {
            walk2.DestinationTrigger = cell;
            control.TimeSinceDecision = 0;
          }
        } else {
          needs3.Target[2 /* FOOD */] = void 0;
        }
      } else if (needs3.Value[3 /* SLEEP */] < SATISFY_THRESHOLD && needs3.Value[3 /* SLEEP */] < needs3.Value[2 /* FOOD */]) {
        control.Says = "I'm tired!";
        let sleep_target = needs3.Target[3 /* SLEEP */];
        if (sleep_target && game.World.Signature[sleep_target] & 16384 /* Satisfy */ && game.World.Satisfy[sleep_target].NeedType === 3 /* SLEEP */) {
          let target_spatial = game.World.SpatialNode2D[sleep_target];
          get_translation(destination_position, target_spatial.World);
          let x = Math.round(destination_position[0]);
          let y = Math.round(destination_position[1]);
          let cell = game.World.Grid[y][x];
          if (current_destination === void 0) {
            walk2.DestinationTrigger = cell;
            control.TimeSinceDecision = 0;
          } else if (cell !== current_destination && needs3.Value[3 /* SLEEP */] < LOW_SATISFY_THRESHOLD) {
            walk2.DestinationTrigger = cell;
            control.TimeSinceDecision = 0;
          }
        } else {
          needs3.Target[3 /* SLEEP */] = void 0;
        }
      } else if (needs3.Value[2 /* FOOD */] > SATISFY_THRESHOLD && needs3.Value[3 /* SLEEP */] > SATISFY_THRESHOLD) {
        control.Says = "Looking for work...";
        let work_target = needs3.Target[1 /* WORK */];
        if (work_target && game.World.Signature[work_target] & 16384 /* Satisfy */ && game.World.Satisfy[work_target].NeedType === 1 /* WORK */) {
          let target_spatial = game.World.SpatialNode2D[work_target];
          get_translation(destination_position, target_spatial.World);
          let x = Math.round(destination_position[0]);
          let y = Math.round(destination_position[1]);
          let cell = game.World.Grid[y][x];
          if (cell !== current_destination) {
            walk2.DestinationTrigger = cell;
            control.TimeSinceDecision = 0;
          }
        } else {
          needs3.Target[1 /* WORK */] = void 0;
        }
      } else if (walkables.length > 0 && walk2.Path.length === 0) {
        console.log("z jakiego\u015B powodu duszek is wandering around without a purpose");
        walk2.DestinationTrigger = element(walkables);
        control.TimeSinceDecision = 0;
        control.Says = "I'm bored!";
      }
    }
  }

  // src/systems/sys_control_camera_follow.ts
  function sys_control_camera_follow(game, delta) {
    let camera_entity = game.Cameras[1];
    if (camera_entity === void 0) {
      return;
    }
    if (game.SelectedEntity !== null) {
      let camera_follow = game.World.Follow[camera_entity];
      camera_follow.Target = game.SelectedEntity;
      game.World.Signature[camera_entity] |= 256 /* Follow */;
      if (game.World.Signature[game.SelectedEntity] & 4096 /* Needs */) {
      } else if (game.World.Signature[game.SelectedEntity] & 16384 /* Satisfy */) {
      } else {
        game.SelectedEntity = null;
        game.World.Signature[camera_entity] &= ~256 /* Follow */;
      }
    }
  }

  // lib/number.ts
  function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, value));
  }
  function map_range(value, old_min, old_max, new_min, new_max) {
    return (value - old_min) / (old_max - old_min) * (new_max - new_min) + new_min;
  }

  // src/components/com_camera2d.ts
  function camera2d(target, radius) {
    return (game, entity) => {
      game.World.Signature[entity] |= 2 /* Camera2D */;
      game.World.Camera2D[entity] = {
        Target: target,
        Projection: {
          Radius: radius,
          Projection: [1 / radius[0], 0, 0, 1 / radius[1], 0, 0],
          Inverse: [radius[0], 0, 0, radius[1], 0, 0]
        },
        Pv: create(),
        World: create(),
        ViewportWidth: 200,
        ViewportHeight: 200
      };
    };
  }
  function viewport_to_world(out, camera, pos) {
    out[0] = pos[0] / camera.ViewportWidth * 2 - 1;
    out[1] = -(pos[1] / camera.ViewportHeight) * 2 + 1;
    transform_position(out, out, camera.Projection.Inverse);
    transform_position(out, out, camera.World);
  }

  // src/systems/sys_control_camera_main.ts
  var pointer_position = [0, 0];
  var wheel_y_clamped = 0;
  function sys_control_camera_main(game, delta) {
    let camera_entity = game.Cameras[0];
    if (camera_entity === void 0) {
      return;
    }
    let camera = game.World.Camera2D[camera_entity];
    let camera_local = game.World.LocalTransform2D[camera_entity];
    if (game.InputDelta["WheelY"]) {
      let cur_zoom = 4 ** (wheel_y_clamped / -500);
      wheel_y_clamped = clamp(wheel_y_clamped + game.InputDelta["WheelY"], -1e3, 500);
      let new_zoom = 4 ** (wheel_y_clamped / -500);
      game.UnitSize = 16 * new_zoom;
      game.ViewportResized = true;
      if (pointer_viewport(game, pointer_position)) {
        viewport_to_world(pointer_position, camera, pointer_position);
        let offset = [0, 0];
        subtract(offset, pointer_position, camera_local.Translation);
        scale(offset, offset, 1 - cur_zoom / new_zoom);
        camera_local.Translation[0] += offset[0];
        camera_local.Translation[1] += offset[1];
        game.World.Signature[camera_entity] |= 64 /* Dirty */;
      }
    }
    if (game.InputDistance["Mouse2"] > 5) {
      document.body.classList.add("grabbing");
      camera_local.Translation[0] -= game.InputDelta["MouseX"] / game.UnitSize;
      camera_local.Translation[1] += game.InputDelta["MouseY"] / game.UnitSize;
      game.World.Signature[camera_entity] |= 64 /* Dirty */;
    }
    if (game.InputDelta["Mouse2"] === -1) {
      document.body.classList.remove("grabbing");
    }
  }

  // src/systems/sys_control_mouse.ts
  var QUERY7 = 16 /* ControlPlayer */ | 1024 /* LocalTransform2D */;
  var WALKING = 65536 /* Walk */ | 8192 /* Render2D */;
  function sys_control_mouse(game, delta) {
    {
      let x = Math.round(game.PointerPosition[0]);
      let y = Math.round(game.PointerPosition[1]);
      let cell = game.World.Grid[y]?.[x];
      if (cell && cell.TileEntity !== null) {
        let render = game.World.Render2D[cell.TileEntity];
        render.Color[0] = 1;
        render.Color[1] = 1;
        render.Color[2] = 1;
      }
    }
    if (!pointer_viewport(game, game.PointerPosition)) {
      return;
    }
    let main_camera_entity = game.Cameras[0];
    if (main_camera_entity !== void 0) {
      let camera = game.World.Camera2D[main_camera_entity];
      viewport_to_world(game.PointerPosition, camera, game.PointerPosition);
    }
    if (pointer_clicked(game, 0)) {
      game.SelectedEntity = null;
      let x = Math.round(game.PointerPosition[0]);
      let y = Math.round(game.PointerPosition[1]);
      let cell = game.World.Grid[y]?.[x];
      if (cell && cell.TileEntity !== null) {
        if (cell.Ocupados.length > 0) {
          game.SelectedEntity = cell.Ocupados[0];
          if (true) {
            let duszki = {};
            for (let ent of cell.Ocupados) {
              let needs3 = game.World.Needs[ent];
              duszki[ent] = {
                Happy: needs3.Value[0 /* HAPPY */],
                Food: needs3.Value[2 /* FOOD */],
                Sleep: needs3.Value[3 /* SLEEP */]
              };
            }
            console.table(duszki);
          }
        } else if (game.World.Signature[cell.TileEntity] & 32768 /* SpatialNode2D */) {
          for (let parent_entity of query_up(game.World, cell.TileEntity, 128 /* Generator */)) {
            game.SelectedEntity = parent_entity;
          }
        }
      }
    }
    if (pointer_clicked(game, 1)) {
      let x = Math.round(game.PointerPosition[0]);
      let y = Math.round(game.PointerPosition[1]);
      let cell = game.World.Grid[y]?.[x];
      if (cell) {
        console.table(cell);
      }
    }
    for (let ent = 0; ent < game.World.Signature.length; ent++) {
      if ((game.World.Signature[ent] & QUERY7) == QUERY7) {
        let local = game.World.LocalTransform2D[ent];
        local.Translation[0] = Math.round(game.PointerPosition[0]);
        local.Translation[1] = Math.round(game.PointerPosition[1]);
        game.World.Signature[ent] |= 64 /* Dirty */;
      }
    }
  }

  // src/systems/sys_follow2d.ts
  var QUERY8 = 1024 /* LocalTransform2D */ | 256 /* Follow */;
  function sys_follow(game, delta) {
    for (let ent = 0; ent < game.World.Signature.length; ent++) {
      if ((game.World.Signature[ent] & QUERY8) === QUERY8) {
        update3(game, ent);
      }
    }
  }
  function update3(game, entity) {
    let entity_local = game.World.LocalTransform2D[entity];
    let entity_follow = game.World.Follow[entity];
    let target_entity = entity_follow.Target;
    let target_local = game.World.LocalTransform2D[target_entity];
    lerp(entity_local.Translation, entity_local.Translation, target_local.Translation, 0.1);
    game.World.Signature[entity] |= 64 /* Dirty */;
  }

  // src/systems/sys_generate.ts
  var QUERY9 = 128 /* Generator */;
  function sys_generate(game, delta) {
    game.GeneratorCounts = new Array(GENERATORS.length).fill(0);
    game.GeneratorOccupancy = new Array(GENERATORS.length).fill(0);
    for (let ent = 0; ent < game.World.Signature.length; ent++) {
      if ((game.World.Signature[ent] & QUERY9) == QUERY9) {
        let gen = game.World.Generator[ent];
        game.GeneratorCounts[gen.Id]++;
        let satisfy2 = game.World.Satisfy[ent];
        game.GeneratorOccupancy[gen.Id] += satisfy2.Ocupados.length;
      }
    }
    game.IncomePerSecond = 0;
    for (let ent = 0; ent < game.World.Signature.length; ent++) {
      if ((game.World.Signature[ent] & QUERY9) == QUERY9) {
        for (let child_entity of query_down(game.World, ent, 16384 /* Satisfy */)) {
          let satisfy2 = game.World.Satisfy[child_entity];
          if (satisfy2.Ocupados.length > 0) {
            let entity_generator = game.World.Generator[ent];
            let gen_id = entity_generator.Id;
            let gen_count = game.GeneratorOccupancy[gen_id];
            let gen_config = GENERATORS[gen_id];
            let gen_income = income(gen_config, gen_count);
            game.IncomePerSecond += gen_income;
            game.World.TotalWealth += gen_income * delta;
          }
          break;
        }
      }
    }
  }

  // src/systems/sys_highlight.ts
  var QUERY_DUSZEK = 8 /* ControlAi */ | 4096 /* Needs */;
  var QUERY_BUILDING = 16384 /* Satisfy */ | 128 /* Generator */;
  function sys_highlight(game, delta) {
    for (let ent = 0; ent < game.World.Signature.length; ent++) {
      if (game.World.Signature[ent] & 8192 /* Render2D */) {
        let render = game.World.Render2D[ent];
        if (render.Color[3] > 1) {
          render.Color[3] = 1;
        }
      }
    }
    for (let ent = 0; ent < game.World.Signature.length; ent++) {
      if (ent === game.SelectedEntity) {
        if ((game.World.Signature[ent] & QUERY_DUSZEK) == QUERY_DUSZEK) {
          highlight_duszek(game, ent);
        } else if ((game.World.Signature[ent] & QUERY_BUILDING) == QUERY_BUILDING) {
          highlight_building(game, ent);
        }
      }
    }
  }
  function highlight_duszek(game, entity) {
    if (game.World.Signature[entity] & 8192 /* Render2D */) {
      let render = game.World.Render2D[entity];
      render.Color[3] = 2;
    }
    let needs3 = game.World.Needs[entity];
    {
      let target_entity = needs3.Target[2 /* FOOD */];
      if (target_entity !== void 0) {
        for (let child_entity of query_down(game.World, target_entity, 8192 /* Render2D */)) {
          let render = game.World.Render2D[child_entity];
          render.Color[3] = 1.5;
        }
      }
    }
    {
      let target_entity = needs3.Target[3 /* SLEEP */];
      if (target_entity !== void 0) {
        for (let child_entity of query_down(game.World, target_entity, 8192 /* Render2D */)) {
          let render = game.World.Render2D[child_entity];
          render.Color[3] = 1.5;
        }
      }
    }
    {
      let target_entity = needs3.Target[1 /* WORK */];
      if (target_entity !== void 0) {
        for (let child_entity of query_down(game.World, target_entity, 8192 /* Render2D */)) {
          let render = game.World.Render2D[child_entity];
          render.Color[3] = 1.5;
        }
      }
    }
    let walk2 = game.World.Walk[entity];
    for (let i = 0; i < walk2.Path.length - 1; i++) {
      let cell = walk2.Path[i];
      let ratio = (i + 1) / walk2.Path.length;
      if (cell.Walkable && cell.TileEntity !== null) {
        let render = game.World.Render2D[cell.TileEntity];
        render.Color[3] = 1.2 + ratio / 3;
      }
    }
  }
  function highlight_building(game, entity) {
    for (let child_entity of query_down(game.World, entity, 8192 /* Render2D */)) {
      let render = game.World.Render2D[child_entity];
      render.Color[3] = 1.5;
    }
  }

  // src/systems/sys_lifespan.ts
  var QUERY10 = 512 /* Lifespan */;
  function sys_lifespan(game, delta) {
    for (let i = 0; i < game.World.Signature.length; i++) {
      if ((game.World.Signature[i] & QUERY10) == QUERY10) {
        update4(game, i, delta);
      }
    }
  }
  function update4(game, entity, delta) {
    let lifespan2 = game.World.Lifespan[entity];
    lifespan2.Remaining -= delta;
    if (lifespan2.Remaining < 0) {
      destroy_all(game.World, entity);
    }
  }

  // src/systems/sys_move2d.ts
  var QUERY11 = 1024 /* LocalTransform2D */ | 2048 /* Move2D */ | 64 /* Dirty */;
  function sys_move2d(game, delta) {
    for (let i = 0; i < game.World.Signature.length; i++) {
      if ((game.World.Signature[i] & QUERY11) === QUERY11) {
        update5(game, i, delta);
      }
    }
  }
  var direction = [0, 0];
  function update5(game, entity, delta) {
    let local = game.World.LocalTransform2D[entity];
    let move = game.World.Move2D[entity];
    if (move.Direction[0] || move.Direction[1]) {
      scale(direction, move.Direction, move.MoveSpeed * delta);
      add(local.Translation, local.Translation, direction);
      move.Direction[0] = 0;
      move.Direction[1] = 0;
    }
  }

  // src/systems/sys_needs.ts
  var QUERY12 = 4096 /* Needs */ | 1 /* Alive */ | 1024 /* LocalTransform2D */;
  var SATISFY_QUERY = 16384 /* Satisfy */;
  var food_destination = [];
  var work_destination = [];
  var sleep_destination = [];
  function sys_needs(game, delta) {
    food_destination = [];
    work_destination = [];
    sleep_destination = [];
    for (let i = 0; i < game.World.Signature.length; i++) {
      if ((game.World.Signature[i] & SATISFY_QUERY) == SATISFY_QUERY) {
        let satisfy2 = game.World.Satisfy[i];
        if (satisfy2.NeedType == 2 /* FOOD */) {
          food_destination.push(i);
          game.FrameStats.RestaurantSeats += satisfy2.Capacity;
        } else if (satisfy2.NeedType == 1 /* WORK */) {
          work_destination.push(i);
          game.FrameStats.Workplaces += satisfy2.Capacity;
        } else if (satisfy2.NeedType == 3 /* SLEEP */) {
          sleep_destination.push(i);
          game.FrameStats.Beds += satisfy2.Capacity;
        }
      }
    }
    for (let i = 0; i < game.World.Signature.length; i++) {
      if ((game.World.Signature[i] & QUERY12) == QUERY12) {
        update6(game, i, delta);
      }
    }
  }
  function update6(game, entity, delta) {
    let local = game.World.LocalTransform2D[entity];
    let needs3 = game.World.Needs[entity];
    if (!needs3.Target[2 /* FOOD */]) {
      needs3.Target[2 /* FOOD */] = element(food_destination);
    }
    if (!needs3.Target[1 /* WORK */]) {
      needs3.Target[1 /* WORK */] = element(work_destination);
    }
    if (!needs3.Target[3 /* SLEEP */]) {
      needs3.Target[3 /* SLEEP */] = element(sleep_destination);
    }
    needs3.Value[2 /* FOOD */] -= needs3.Delta[2 /* FOOD */] * delta;
    needs3.Value[3 /* SLEEP */] -= needs3.Delta[3 /* SLEEP */] * delta;
    let x = Math.round(local.Translation[0]);
    let y = Math.round(local.Translation[1]);
    needs3.Value[0 /* HAPPY */] -= needs3.Delta[0 /* HAPPY */] * delta;
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        if (game.World.Grid[y + i]?.[x + j]?.Pleasant) {
          needs3.Value[0 /* HAPPY */] += needs3.Delta[0 /* HAPPY */] * delta;
        }
      }
    }
    needs3.Value[0 /* HAPPY */] = clamp(needs3.Value[0 /* HAPPY */]);
    game.FrameStats[0 /* HAPPY */] += clamp(needs3.Value[0 /* HAPPY */]);
    if (needs3.Value[0 /* HAPPY */] <= LOW_SATISFY_THRESHOLD) {
      game.FrameStats.DuszkiUnhappy++;
    }
    game.FrameStats[2 /* FOOD */] += clamp(needs3.Value[2 /* FOOD */]);
    if (needs3.Value[2 /* FOOD */] <= LOW_SATISFY_THRESHOLD) {
      game.FrameStats.DuszkiHungry++;
    }
    game.FrameStats[3 /* SLEEP */] += clamp(needs3.Value[3 /* SLEEP */]);
    if (needs3.Value[3 /* SLEEP */] <= LOW_SATISFY_THRESHOLD) {
      game.FrameStats.DuszkiTired++;
    }
  }

  // src/systems/sys_populate.ts
  var spawn_timeout = 2;
  var time_since_last_spawn = spawn_timeout;
  var initial_population = 5;
  function sys_populate(game, delta) {
    time_since_last_spawn -= delta;
    game.PopulationSituation = "";
    let total_duszki = Math.max(game.World.DuszkiAlive, game.World.Population);
    if (time_since_last_spawn > 0) {
      return;
    }
    let enough_beds = game.FrameStats.Beds > total_duszki / 3;
    let enough_food = game.FrameStats.RestaurantSeats > total_duszki / 3;
    let enough_work = game.FrameStats.Workplaces > total_duszki / 3;
    let low_mortality = game.World.Mortality < 0.3;
    let high_happiness = game.FrameStats[0 /* HAPPY */] / total_duszki > 0.5;
    if (total_duszki < initial_population && (game.FrameStats.Beds > 0 || game.FrameStats.Workplaces > 0 || game.FrameStats.RestaurantSeats > 0)) {
      time_since_last_spawn = spawn_timeout;
      dispatch(game, 4 /* SpawnDuszek */, {});
    } else if (enough_beds && enough_food && enough_work && low_mortality && high_happiness) {
      time_since_last_spawn = spawn_timeout;
      dispatch(game, 4 /* SpawnDuszek */, {});
    } else {
      if (!enough_beds) {
        game.PopulationSituation = "The cemeteries are too few, duszki have nowhere to sleep!";
      } else if (!enough_food) {
        game.PopulationSituation = "There is not enough chapels, duszki have nowhere to eat!";
      } else if (!enough_work) {
        game.PopulationSituation = "There is not enough crypts, duszki have nowhere to work!";
      } else if (!low_mortality) {
        game.PopulationSituation = "The mortality rate is too high, duszki are dying on the streets!";
      } else if (!high_happiness) {
        game.PopulationSituation = "Duszki are unhappy, build some parks!";
      }
    }
  }

  // src/systems/sys_render2d.ts
  function sys_render2d(game, delta) {
    for (let ent = 0; ent < game.World.Signature.length; ent++) {
      let signature = game.World.Signature[ent] & (8192 /* Render2D */ | 32768 /* SpatialNode2D */);
      let signature_offset = ent * FLOATS_PER_INSTANCE + 7;
      if (game.World.InstanceData[signature_offset] !== signature) {
        game.World.InstanceData[signature_offset] = signature;
      }
      if (signature & 8192 /* Render2D */) {
        let render = game.World.Render2D[ent];
        let shift_offset = ent * FLOATS_PER_INSTANCE + 6;
        if (signature & 32768 /* SpatialNode2D */) {
          let spatial = game.World.SpatialNode2D[ent];
          if (spatial.Parent !== void 0) {
            let parent_spatial = game.World.SpatialNode2D[spatial.Parent];
            let shift3 = (parent_spatial.World[5] - render.Shift) / game.World.Height;
            game.World.InstanceData[shift_offset] = map_range(shift3, -1, 1, 0.5, -0.5);
          } else {
            let shift3 = (spatial.World[5] - render.Shift) / game.World.Height;
            game.World.InstanceData[shift_offset] = map_range(shift3, -1, 1, 0.5, -0.5);
          }
        } else {
          let local = game.World.LocalTransform2D[ent];
          let shift3 = (local.Translation[1] - render.Shift) / game.World.Height;
          game.World.InstanceData[shift_offset] = map_range(shift3, -1, 1, 0.5, -0.5);
        }
      }
    }
    game.Gl.bindFramebuffer(GL_FRAMEBUFFER, null);
    game.Gl.bindBuffer(GL_ARRAY_BUFFER, game.InstanceBuffer);
    game.Gl.bufferData(GL_ARRAY_BUFFER, game.World.InstanceData, GL_STREAM_DRAW);
    {
      let camera_entity = game.Cameras[0];
      let camera = game.World.Camera2D[camera_entity];
      game.Gl.clear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
      game.Gl.viewport(0, 0, camera.ViewportWidth, camera.ViewportHeight);
      render_all(game, camera);
    }
    {
      let camera_entity = game.Cameras[1];
      let camera = game.World.Camera2D[camera_entity];
      let x = 10;
      let y = game.ViewportHeight - camera.ViewportHeight - 10;
      game.Gl.enable(GL_SCISSOR_TEST);
      game.Gl.scissor(x, y, camera.ViewportWidth, camera.ViewportHeight);
      game.Gl.clear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
      game.Gl.disable(GL_SCISSOR_TEST);
      game.Gl.viewport(x, y, camera.ViewportWidth, camera.ViewportHeight);
      render_all(game, camera);
    }
  }
  function render_all(game, eye) {
    let material = game.MaterialRender2D;
    game.Gl.useProgram(material.Program);
    game.Gl.uniformMatrix3x2fv(material.Locations.Pv, false, eye.Pv);
    game.Gl.activeTexture(GL_TEXTURE0);
    game.Gl.bindTexture(GL_TEXTURE_2D, game.Spritesheet);
    game.Gl.uniform1i(material.Locations.SheetTexture, 0);
    game.Gl.drawArraysInstanced(material.Mode, 0, 4, game.World.Signature.length);
  }

  // src/systems/sys_resize2d.ts
  var QUERY13 = 2 /* Camera2D */;
  function sys_resize2d(game, delta) {
    if (game.ViewportWidth != window.innerWidth || game.ViewportHeight != window.innerHeight) {
      game.ViewportResized = true;
    }
    if (game.ViewportResized) {
      game.ViewportWidth = game.SceneCanvas.width = window.innerWidth;
      game.ViewportHeight = game.SceneCanvas.height = window.innerHeight;
      for (let ent = 0; ent < game.World.Signature.length; ent++) {
        if ((game.World.Signature[ent] & QUERY13) === QUERY13) {
          update7(game, ent);
        }
      }
    }
  }
  function update7(game, entity) {
    let camera = game.World.Camera2D[entity];
    if (camera.Target === 0 /* Main */) {
      camera.ViewportWidth = game.ViewportWidth;
      camera.ViewportHeight = game.ViewportHeight;
    } else if (camera.Target === 1 /* Follow */) {
      game.FollowCanvas.width = camera.ViewportWidth;
      game.FollowCanvas.height = camera.ViewportHeight;
    }
    let projection = camera.Projection;
    let aspect = camera.ViewportWidth / camera.ViewportHeight;
    if (projection.Radius[0] === 0 && projection.Radius[1] === 0) {
      let radius = game.ViewportHeight / game.UnitSize / 2;
      from_ortho(projection.Projection, radius * aspect, radius);
    } else {
      let target_aspect = projection.Radius[0] / projection.Radius[1];
      if (aspect < target_aspect) {
        from_ortho(projection.Projection, projection.Radius[0], projection.Radius[0] / aspect);
      } else {
        from_ortho(projection.Projection, projection.Radius[1] * aspect, projection.Radius[1]);
      }
    }
    invert(projection.Inverse, projection.Projection);
  }

  // src/systems/sys_save.ts
  var INTERVAL = 5;
  var since_last = 0;
  function sys_save(game, delta) {
    since_last += delta;
    if (since_last > INTERVAL) {
      since_last = 0;
      put(game.Store, game.World);
    }
  }

  // lib/html.ts
  function shift2(values) {
    let value = values.shift();
    if (value || value === 0) {
      return value;
    } else {
      return "";
    }
  }
  function htm(strings, ...values) {
    return strings.reduce((out, cur) => out + shift2(values) + cur);
  }

  // src/ui/Dialog.ts
  function Dialog(game, message) {
    return htm`<dialog
        open
        style="
            position:absolute;
            inset:0;
            width:400px;
            border-radius:10px;
            background:#66e9;
            backdrop-filter:blur(10px);
            text-align:center;
            color:#fff;
        "
    >
        <p>${message}</p>
        <form method=dialog>
            <button type=submit>OK</button>
        </form>
    </dialog>`;
  }

  // src/systems/sys_score.ts
  function sys_score(game, delta) {
    game.World.Age += delta;
    let weight = Math.min(1, delta / 60);
    game.World.Population += (game.World.DuszkiAlive - game.World.Population) * weight;
    game.World.Immigration += (game.FrameStats.Spawns / delta - game.World.Immigration) * weight;
    game.World.Mortality += (game.FrameStats.Deaths / delta - game.World.Mortality) * weight;
    if (game.World.Population > 0) {
      let out_of = Math.max(game.World.DuszkiAlive, game.World.Population);
      let happy_percent = game.FrameStats[0 /* HAPPY */] / out_of;
      game.World.Happiness += (happy_percent - game.World.Happiness) * weight;
      let food_percent = game.FrameStats[2 /* FOOD */] / out_of;
      game.World.Nutrition += (food_percent - game.World.Nutrition) * weight;
      let sleep_percent = game.FrameStats[3 /* SLEEP */] / out_of;
      game.World.Restedness += (sleep_percent - game.World.Restedness) * weight;
      let working_percent = game.World.DuszkiWorking / out_of;
      game.World.Employment += (working_percent - game.World.Employment) * weight;
    } else {
      game.World.Happiness = 0;
      game.World.Nutrition = 0;
      game.World.Restedness = 0;
    }
    if (game.World.Milestone === 0) {
      game.World.Milestone++;
      let dialog = Dialog(game, `<h1>Welcome to AFTERLIFE!</h1>
            <p>Where do Pac-Man's ghosts go when they die? They come here \u2014 to the ghost town full of life!</p>
            <hr>
            <p>Foster a community of <em>duszki</em> (Polish for ghosts) by providing them with housing, food, and work.</p>
            `);
      document.body.insertAdjacentHTML("beforeend", dialog);
    } else if (game.World.Population >= 10 ** (game.World.Milestone + 1)) {
      game.World.Milestone++;
      let dialog = Dialog(game, `<h1>You've reached ${10 ** game.World.Milestone} population!</h1>`);
      document.body.insertAdjacentHTML("beforeend", dialog);
    }
  }

  // src/systems/sys_transform2d.ts
  var QUERY_DIRTY = 1024 /* LocalTransform2D */ | 64 /* Dirty */;
  var QUERY_NODE = 1024 /* LocalTransform2D */ | 32768 /* SpatialNode2D */;
  function sys_transform2d(game, delta) {
    for (let ent = 0; ent < game.World.Signature.length; ent++) {
      if ((game.World.Signature[ent] & QUERY_DIRTY) === QUERY_DIRTY) {
        update_instance_data(game, ent);
        if (game.World.Signature[ent] & 32768 /* SpatialNode2D */) {
          update_spatial_node(game, ent);
        }
      }
    }
  }
  function update_instance_data(game, entity) {
    game.World.Signature[entity] &= ~64 /* Dirty */;
    let local = game.World.LocalTransform2D[entity];
    let instance_offset = entity * FLOATS_PER_INSTANCE;
    game.World.InstanceData[instance_offset + 0] = local.Scale[0];
    game.World.InstanceData[instance_offset + 3] = local.Scale[1];
    game.World.InstanceData[instance_offset + 4] = local.Translation[0];
    game.World.InstanceData[instance_offset + 5] = local.Translation[1];
  }
  function update_spatial_node(game, entity, parent) {
    let node = game.World.SpatialNode2D[entity];
    if (parent !== void 0) {
      node.Parent = parent;
    }
    if (node.Parent !== void 0) {
      let parent_transform = game.World.SpatialNode2D[node.Parent];
      multiply(node.World, parent_transform.World, node.World);
    }
    if (game.World.Signature[entity] & 32 /* Children */) {
      let children2 = game.World.Children[entity];
      for (let i = 0; i < children2.Children.length; i++) {
        let child = children2.Children[i];
        if ((game.World.Signature[child] & QUERY_NODE) === QUERY_NODE) {
          update_instance_data(game, child);
          update_spatial_node(game, child, entity);
        }
      }
    }
  }

  // src/ui/Advisor.ts
  function Advisor(game) {
    return htm`<marquee
        style="
            font-size:25px;
            font-style:italic;
        "
    >
        ${game.PopulationSituation}
    </marquee>`;
  }

  // src/ui/Overview.ts
  var cost_fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
  function Overview(game) {
    return htm`<div>
        <label>Wealth: ${cost_fmt.format(game.World.TotalWealth)}</label>
        <label>Income: ${cost_fmt.format(game.IncomePerSecond * 60)}/min</label>
        <hr>
        <label>Population: ${game.World.Population.toFixed(0)}</label>
        <label>Immigration: ${(game.World.Immigration * 60).toFixed(0)}/min</label>
        <label>Mortality: ${(game.World.Mortality * 60).toFixed(0)}/min</label>
        <hr>
        <label>Happiness: ${game.FrameStats.DuszkiUnhappy} unhappy
            <meter value="${game.World.Happiness}"></meter></label>
        <label>Nutrition: ${game.FrameStats.DuszkiHungry} hungry
            <meter value="${game.World.Nutrition}"></meter></label>
        <label>Restedness: ${game.FrameStats.DuszkiTired} tired
            <meter value="${game.World.Restedness}"></meter></label>
        <label>Employment: ${game.World.DuszkiWorking} at work
            <meter value="${game.World.Employment}"></meter></label>
    </div>`;
  }

  // src/ui/Commands.ts
  function Commands(game) {
    return htm`<nav onmousedown="event.stopPropagation()" onmouseup="event.stopPropagation()">
        <button onclick="$(${0 /* EnterPlaceRoad */})">Road</button>
        <button onclick="$(${1 /* EnterPlaceTree */})">Tree</button>
        <button onclick="$(${3 /* EnterErase */})">Erase</button>
        <hr>

        ${BuildingButton(game, 0 /* Sleep */)}
        ${BuildingButton(game, 1 /* Food */)}
        ${BuildingButton(game, 2 /* Work */)}

        <hr>
        <label><input type=checkbox checked disabled>Autosave</label>
        <label><input type=checkbox ${game.MusicEnabled && "checked"}
            onchange="$(${8 /* ToggleMusic */}, this.checked)">Music</label>
        <hr>
        <button onclick="$(${6 /* ResetGame */})">Reset</button>
        <em>Play time: ${(game.World.Age / 60).toFixed(0)} min.</em>
    </nav>`;
  }
  function BuildingButton(game, id) {
    let gen_config = GENERATORS[id];
    let gen_cost = total_cost(gen_config, game.GeneratorCounts[id]);
    return htm`
        <button
            ${gen_cost > game.World.TotalWealth && "disabled"}
            onclick="$(${2 /* EnterPlaceBuilding */}, ${id})"
            style="width:100%"
        >
            <big>${gen_config.Name}</big> (${cost_fmt.format(gen_cost)})<br>
            ${gen_config.Description}
        </button>
    `;
  }

  // src/ui/Details.ts
  function Details(game) {
    if (game.SelectedEntity === null) {
      return "<em>Select something to see details.</em>";
    }
    let entity = game.SelectedEntity;
    if (game.World.Signature[entity] & 4096 /* Needs */) {
      let needs3 = game.World.Needs[entity];
      let control = game.World.ControlAi[entity];
      let alive = (game.World.Signature[entity] & 8 /* ControlAi */) === 8 /* ControlAi */;
      return htm`
            <big>${control.Name}</big>
            <label><em>${alive ? control.Says : "Dead"}</em></label>
            <hr>
            <label>Happy <meter value="${needs3.Value[0 /* HAPPY */]}"
                low="${LOW_SATISFY_THRESHOLD}"></meter></label>
            <label>Fed <meter value="${needs3.Value[2 /* FOOD */]}"
                low="${LOW_SATISFY_THRESHOLD}"></meter></label>
            <label>Rested <meter value="${needs3.Value[3 /* SLEEP */]}"
                low="${LOW_SATISFY_THRESHOLD}"></meter></label>
        `;
    } else if (game.World.Signature[entity] & 16384 /* Satisfy */) {
      let generator2 = game.World.Generator[entity];
      let satisfy2 = game.World.Satisfy[entity];
      let occupancy = satisfy2.Ocupados.length / satisfy2.Capacity;
      return htm`
            <big>${GENERATORS[generator2.Id].Name}</big>
            <label><em>${GENERATORS[generator2.Id].Description}</em></label>
            <hr>
            <label>Occupancy <meter value="${occupancy}"></meter></label>
        `;
    }
    return "";
  }

  // src/systems/sys_ui.ts
  var nexts = [];
  var prevs = [];
  var time_since_last_update = 1;
  function sys_ui(game, delta) {
    time_since_last_update += delta;
    if (time_since_last_update > 1) {
      time_since_last_update = 0;
      nexts[0] = Overview(game);
      nexts[2] = Commands(game);
      nexts[3] = Advisor(game);
    }
    nexts[1] = Details(game);
    for (let i = 0; i < nexts.length; i++) {
      if (nexts[i] !== prevs[i]) {
        game.Ui.children[i].innerHTML = prevs[i] = nexts[i];
      }
    }
    game.FollowContext.drawImage(game.SceneCanvas, 10, 10, 200, 200, 0, 0, 200, 200);
    let minimap_image_data = game.MinimapContext.getImageData(0, 0, game.World.Width, game.World.Height);
    for (let y = 0; y < game.World.Height; y++) {
      for (let x = 0; x < game.World.Width; x++) {
        let index = ((game.World.Height - y - 1) * game.World.Width + x) * 4;
        let cell = game.World.Grid[y][x];
        if (cell.Walkable) {
          minimap_image_data.data[index + 0] = 182;
          minimap_image_data.data[index + 1] = 172;
          minimap_image_data.data[index + 2] = 82;
          minimap_image_data.data[index + 3] = 255;
        } else if (cell.Pleasant) {
          minimap_image_data.data[index + 0] = 54;
          minimap_image_data.data[index + 1] = 126;
          minimap_image_data.data[index + 2] = 81;
          minimap_image_data.data[index + 3] = 255;
        } else if (cell.TileEntity) {
          minimap_image_data.data[index + 0] = 163;
          minimap_image_data.data[index + 1] = 57;
          minimap_image_data.data[index + 2] = 0;
          minimap_image_data.data[index + 3] = 255;
        } else {
          minimap_image_data.data[index + 0] = 88;
          minimap_image_data.data[index + 1] = 151;
          minimap_image_data.data[index + 2] = 64;
          minimap_image_data.data[index + 3] = 255;
        }
      }
    }
    game.MinimapContext.putImageData(minimap_image_data, 0, 0);
    let camera_entity = game.Cameras[0];
    if (camera_entity !== void 0) {
      let camera_local = game.World.LocalTransform2D[camera_entity];
      let x = camera_local.Translation[0];
      let y = camera_local.Translation[1];
      let visible_width = game.ViewportWidth / game.UnitSize;
      let visible_height = game.ViewportHeight / game.UnitSize;
      game.MinimapContext.strokeStyle = "#fff";
      game.MinimapContext.strokeRect(Math.round(x - visible_width / 2) + 0.5, Math.round(game.World.Height - y - visible_height / 2) + 0.5, Math.round(visible_width), Math.round(visible_height));
    }
  }

  // lib/math.ts
  var EPSILON = 1e-6;
  var DEG_TO_RAD = Math.PI / 180;
  var RAD_TO_DEG = 180 / Math.PI;

  // lib/pathfind.ts
  var TRAFFIC_FACTOR = 100;
  var neighbor_offsets = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1]
  ];
  function path_find(world, origin, goal) {
    let predecessors = [];
    let g = [];
    g[origin.Index] = 0;
    let h = [];
    h[origin.Index] = 0;
    let f = [];
    f[origin.Index] = 0;
    let boundary = [origin];
    while (boundary.length > 0) {
      let lowest = lowest_cost(boundary, f);
      let current = boundary.splice(lowest, 1)[0];
      if (current === goal) {
        return [...path_follow(predecessors, goal)].reverse();
      }
      for (let i = 0; i < 4; i++) {
        let offset = neighbor_offsets[i];
        let x = current.Position[0] + offset[0];
        let y = current.Position[1] + offset[1];
        let neighbor = world.Grid[y]?.[x];
        if (!neighbor || !neighbor.Walkable) {
          continue;
        }
        let g_next = g[current.Index] + 1 + neighbor.TrafficIntensity * TRAFFIC_FACTOR;
        if (g[neighbor.Index] === void 0) {
          h[neighbor.Index] = distance_squared(neighbor.Position, goal.Position);
          g[neighbor.Index] = g_next;
          f[neighbor.Index] = g_next + h[neighbor.Index];
          predecessors[neighbor.Index] = current;
          boundary.push(neighbor);
        } else if (g_next + EPSILON < g[neighbor.Index]) {
          g[neighbor.Index] = g_next;
          f[neighbor.Index] = g_next + h[neighbor.Index];
          predecessors[neighbor.Index] = current;
        }
      }
    }
    return false;
  }
  function lowest_cost(boundary, cost) {
    let min = 0;
    for (let i = 0; i < boundary.length; i++) {
      if (cost[boundary[i].Index] + EPSILON < cost[boundary[min].Index]) {
        min = i;
      }
    }
    return min;
  }
  function* path_follow(path, goal) {
    while (goal !== void 0) {
      yield goal;
      goal = path[goal.Index];
    }
  }

  // src/systems/sys_walk.ts
  var QUERY14 = 1024 /* LocalTransform2D */ | 65536 /* Walk */;
  function sys_walk(game, delta) {
    for (let y = 0; y < game.World.Grid.length; y++) {
      for (let x = 0; x < game.World.Grid[y].length; x++) {
        let cell = game.World.Grid[y][x];
        let weight = Math.min(1, delta / 10);
        cell.TrafficIntensity += (cell.Ocupados.length - cell.TrafficIntensity) * weight;
        cell.Ocupados = [];
      }
    }
    for (let ent = 0; ent < game.World.Signature.length; ent++) {
      if ((game.World.Signature[ent] & QUERY14) == QUERY14) {
        update8(game, ent);
      }
    }
  }
  var diff = [0, 0];
  function update8(game, entity) {
    let walk2 = game.World.Walk[entity];
    let local = game.World.LocalTransform2D[entity];
    let x = Math.round(local.Translation[0]);
    let y = Math.round(local.Translation[1]);
    let cell = game.World.Grid[y]?.[x];
    if (!cell) {
      return;
    }
    cell.Ocupados.push(entity);
    if (walk2.DestinationTrigger !== null) {
      let path = path_find(game.World, cell, walk2.DestinationTrigger);
      if (path) {
        walk2.Path = path.slice(1);
        walk2.DestinationTrigger = null;
      }
    }
    if (walk2.Path.length > 0) {
      let local2 = game.World.LocalTransform2D[entity];
      let next_cell = walk2.Path[0];
      if (!next_cell.Walkable) {
        walk2.Path = [];
      }
      if (distance_squared(next_cell.Position, local2.Translation) < 0.01) {
        cell.TimesWalked++;
        walk2.Path.shift();
        if (!cell.Updated && cell.TimesWalked > ROAD_UPDATE_WALKS_THRESHOLD) {
          make_tiled_road(game, x, y);
          cell.Updated = true;
        }
      } else {
        let move = game.World.Move2D[entity];
        subtract(diff, next_cell.Position, local2.Translation);
        normalize(diff, diff);
        add(move.Direction, move.Direction, diff);
        game.World.Signature[entity] |= 64 /* Dirty */;
      }
    }
  }

  // src/ui/App.ts
  function App() {
    return htm`
        <div
            onmousedown="event.stopPropagation();"
            onmouseup="event.stopPropagation();"
            onclick="$(${7 /* MinimapNavigation */}, event);"
            style="
                position:absolute;
                top:0;
                left:0;
                width:200px;
                padding:220px 50px 50px 10px;
                border-radius:0 0 100px;
                background:#66e9;
                backdrop-filter:blur(10px);
            "
        ></div>
        <div
            style="
                position:absolute;
                right:0;
                bottom:0;
                width:200px;
                padding:50px 10px 220px 50px;
                border-radius:100px 0 0;
                background:#66e9;
                backdrop-filter:blur(10px);
            "
        ></div>
        <div
            style="
                position:absolute;
                left:0;
                bottom:0;
                width:200px;
                padding:50px 50px 10px 10px;
                border-radius:0 100px 0 0;
                background:#66e9;
                backdrop-filter:blur(10px);
            "
        ></div>
        <div
            style="
                position:absolute;
                top:0;
                right:0;
                width:calc(100% - 400px);
                height:30px;
                padding:10px 10px 10px 50px;
                border-radius:0 0 0 100px;
                background:#66e9;
                backdrop-filter:blur(10px);
            "
        ></div>
    `;
  }

  // src/game.ts
  var WORLD_CAPACITY = 65536;
  var Game = class extends GameImpl {
    constructor(db) {
      super();
      this.World = new World(0, WORLD_CAPACITY);
      this.MinimapCanvas = document.querySelector("canvas#m");
      this.MinimapContext = this.MinimapCanvas.getContext("2d");
      this.FollowCanvas = document.querySelector("canvas#f");
      this.FollowContext = this.FollowCanvas.getContext("2d");
      this.Spritesheet = create_spritesheet_from(this.Gl, document.querySelector("img"));
      this.MaterialRender2D = mat_render2d(this.Gl);
      this.InstanceBuffer = this.Gl.createBuffer();
      this.UnitSize = 16;
      this.PointerPosition = [0, 0];
      this.ActiveBuilding = null;
      this.SelectedEntity = null;
      this.MusicEnabled = true;
      this.GeneratorCounts = [];
      this.GeneratorOccupancy = [];
      this.IncomePerSecond = 0;
      this.PopulationSituation = "";
      this.FrameStats = {
        Spawns: 0,
        Deaths: 0,
        [0 /* HAPPY */]: 0,
        [2 /* FOOD */]: 0,
        [3 /* SLEEP */]: 0,
        Beds: 0,
        RestaurantSeats: 0,
        Workplaces: 0,
        DuszkiUnhappy: 0,
        DuszkiHungry: 0,
        DuszkiTired: 0
      };
      this.Store = db;
      this.MinimapCanvas.width = this.World.Width;
      this.MinimapCanvas.height = this.World.Height;
      this.Ui.innerHTML = App();
      this.Gl.enable(GL_DEPTH_TEST);
      this.Gl.clearColor(0.4, 0.4, 0.4, 1);
      setup_render2d_buffers(this.Gl, this.InstanceBuffer);
    }
    FrameUpdate(delta) {
      sys_control_camera_main(this, delta);
      sys_control_camera_follow(this, delta);
      sys_control_mouse(this, delta);
      sys_build_buildings(this, delta);
      sys_build_roads(this, delta);
      sys_build_trees(this, delta);
      sys_build_erase(this, delta);
      sys_highlight(this, delta);
      sys_needs(this, delta);
      sys_control_ai(this, delta);
      sys_satisfy(this, delta);
      sys_populate(this, delta);
      sys_score(this, delta);
      sys_generate(this, delta);
      sys_walk(this, delta);
      sys_move2d(this, delta);
      sys_follow(this, delta);
      sys_lifespan(this, delta);
      sys_transform2d(this, delta);
      sys_resize2d(this, delta);
      sys_camera2d(this, delta);
      sys_save(this, delta);
      sys_render2d(this, delta);
      sys_ui(this, delta);
      if (this.MusicEnabled) {
        sys_audio_source(this, delta);
      }
    }
    FrameReset(delta) {
      super.FrameReset(delta);
      for (let stat_name in this.FrameStats) {
        this.FrameStats[stat_name] = 0;
      }
    }
  };

  // src/components/com_grid.ts
  function grid(mask, kind) {
    return (game, entity) => {
      let local = game.World.LocalTransform2D[entity];
      let x = Math.round(local.Translation[0]);
      let y = Math.round(local.Translation[1]);
      let cell = game.World.Grid[y]?.[x];
      if (cell) {
        cell.TileEntity = entity;
        cell.Walkable = (mask & 1 /* Walkable */) != 0;
        cell.Pleasant = (mask & 2 /* Pleasant */) != 0;
        cell.Type = kind;
      }
    };
  }

  // src/components/com_follow.ts
  function follow(target) {
    return (game, entity) => {
      game.World.Signature[entity] |= 256 /* Follow */;
      game.World.Follow[entity] = {
        Target: target
      };
    };
  }

  // src/scenes/blu_camera_follow.ts
  function blueprint_camera_follow(game) {
    return [
      spatial_node2d(),
      local_transform2d(),
      camera2d(1 /* Follow */, [2, 2]),
      follow(-1),
      disable(256 /* Follow */)
    ];
  }

  // src/scenes/blu_camera_main.ts
  function blueprint_camera_main(game) {
    return [spatial_node2d(), local_transform2d(), camera2d(0 /* Main */, [0, 0])];
  }

  // src/scenes/blu_grass.ts
  var grass_tiles = [6 /* Grass1 */, 6 /* Grass1 */, 15 /* Grass2 */, 15 /* Grass2 */, 25 /* Flowers */];
  function blueprint_grass(game) {
    return [local_transform2d(), render2d(element(grass_tiles))];
  }
  function blueprint_empty(game) {
    return [local_transform2d(), render2d(0 /* Empty */)];
  }

  // src/scenes/sce_editable_dungeon.ts
  function scene_editable_dungeon(game) {
    instantiate(game, [
      ...blueprint_camera_main(game),
      set_position(game.World.Width / 2 - 0.5, game.World.Height / 2 - 0.5)
    ]);
    instantiate(game, [
      ...blueprint_camera_follow(game),
      set_position(game.World.Width / 2, game.World.Height / 2)
    ]);
    let mid_x = Math.round(game.World.Width / 2);
    let mid_y = Math.round(game.World.Height / 2);
    for (let x = 0; x < game.World.Width; x++) {
      instantiate(game, [...blueprint_empty(game), set_position(x, mid_y), shift(-1)]);
      instantiate(game, [
        ...blueprint_road(game),
        set_position(x, mid_y),
        grid(1 /* Walkable */, 1 /* Road */)
      ]);
      make_tiled_road(game, x, mid_y);
    }
    for (let y = 0; y < game.World.Height; y++) {
      for (let x = 0; x < game.World.Width; x++) {
        let cell = game.World.Grid[y][x];
        if (cell.TileEntity === null) {
          if (float() < 0.1) {
            instantiate(game, [...blueprint_grass(game), set_position(x, y), shift(-1)]);
          } else {
            instantiate(game, [...blueprint_empty(game), set_position(x, y), shift(-1)]);
          }
        }
      }
    }
    let tree_count = game.World.Width * game.World.Height / 2;
    for (let i = 0; i < tree_count; i++) {
      let x = integer(1, game.World.Width - 2);
      let y = integer(1, game.World.Height - 2);
      let cell = game.World.Grid[y][x];
      if (y !== mid_y && (x < mid_x - 10 || x > mid_x + 10 || y < mid_y - 10 || y > mid_y + 10) && !cell.Pleasant) {
        instantiate(game, [
          ...blueprint_tree(game),
          set_position(x, y),
          grid(2 /* Pleasant */, 2 /* Tree */)
        ]);
        make_tiled_park(game, x, y);
      }
    }
  }

  // src/index.ts
  var DEFAULT_WORLD_ID = 1;
  async function main() {
    let db = await connect();
    let game = new Game(db);
    let param_id = new URL(location.href).searchParams.get("id");
    let world_id = param_id ? parseInt(param_id) : DEFAULT_WORLD_ID;
    let saved_world = await get(db, world_id);
    if (saved_world) {
      game.World = saved_world;
    } else {
      game.World.id = world_id;
      scene_editable_dungeon(game);
    }
    game.ViewportResized = true;
    game.Start();
    window.$ = dispatch.bind(null, game);
    window.game = game;
  }
  main();
})();
//# sourceMappingURL=index.js.map
