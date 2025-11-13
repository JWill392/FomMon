/** Multi-layer sparse map.  Each pushed layer masks lower layers.  Missing entries are inherited from lower layers.
 *
 * StackMap: "default",0: {["panda": "black"], ["cat": "orange"]}
 * get("panda") -> "black"
 * get("cat") -> "orange"
 *
 * pushMap("paintPandas")
 * setIn("paintPandas", "pandas", "white")
 * StackMap: "default",0: {["panda": "black"], ["cat": "orange"]},
 *            "paintPandas",1: {["panda": "white"]}
 * get("panda") -> "white"
 * get("cat") -> "orange"
 *
 * popMap("paintPandas")
 * get("panda") -> "black"
 * get("cat") -> "orange"
 * */
export class StackMap<K, V> {

  private readonly mapStack : Map<K, V>[] = [];
  private readonly nameToIndex = new Map<string, number>();
  private readonly indexToName = new Map<number, string>();

  pushMap(name: string) : boolean {
    if (this.nameToIndex.has(name)) return false;

    this.mapStack.push(new Map<K, V>());
    this.nameToIndex.set(name, this.mapStack.length - 1);
    this.indexToName.set(this.mapStack.length - 1, name);
    return true;
  }

  popMap(name: string) : Map<K, V> | undefined {
    const index = this.nameToIndex.get(name);
    if (index === undefined) return undefined;

    const result = this.mapStack[index];
    this.mapStack.splice(index, 1);
    this.nameToIndex.delete(name);
    this.indexToName.delete(index);

    return result;
  }

  has(key: K) : {exists: boolean, name?: string} {
    const get = this._getFrom(key);
    return {exists: !!get, name: get?.name}
  }

  hasFrom(key: K, name: string) : {exists: boolean, name?: string} {
    const get = this._getFrom(key, name);
    return {exists: !!get, name: get?.name}
  }

  hasIn(name: string, key: K) : boolean {
    return this._getMap(name)?.has(key) ?? false;
  }

  get(key: K) : V | undefined {
    return this._getFrom(key)?.value;
  }
  getFrom(key: K, name: string) : V | undefined {
    return this._getFrom(key, name)?.value;
  }
  private _getFrom(key: K, name?: string) : {value: V, name: string} | undefined {
    const top = name ? this.nameToIndex.get(name)! : this.mapStack.length - 1;

    for (let i = top; i >= 0; i--) {
      const map = this.mapStack[i];

      if (map.has(key)) {
        const name = this.indexToName.get(i)!;
        return {value: map.get(key)!, name};
      }
    }
    return undefined;
  }
  getIn(name: string, key: K): V | undefined {
    return this._getMap(name)?.get(key);
  }

  getAll() : Map<K, V> {
    return this._getAll();
  }
  getAllFrom(name: string) : Map<K, V> {
    return this._getAll(name);
  }
  private _getAll(name?: string) : Map<K, V> {
    const result = new Map<K, V>();

    const top = name ? this.nameToIndex.get(name)! : this.mapStack.length - 1;
    for (let i = top; i >=0; i--) {
      const map = this.mapStack[i];
      map.forEach((value, key) => {
        if (result.has(key)) return;
        result.set(key, value);
      })
    }

    return result;
  }
  private _getMap(name: string) : Map<K, V> | undefined {
    const index = this.nameToIndex.get(name);
    if (index === undefined) return undefined;

    const map = this.mapStack[index];
    if (!map) return undefined;

    return map;
  }
  getAllIn(name: string) : Map<K, V> | undefined {
    const map = this._getMap(name);
    if (!map) return undefined;

    return new Map<K, V>(map);
  }

  setIn(name: string, key: K, value: V) : boolean {
    const index = this.nameToIndex.get(name);
    if (index === undefined) return false;

    const priorValue = this.mapStack[index].get(key);
    if (priorValue === value) return false;

    this.mapStack[index].set(key, value);

    return true;
  }
  setMany(name: string, map: Map<K, V>) : boolean {
    let changed = false;
    map.forEach((value, key) => {
      if (this.setIn(name, key, value))
        changed = true;
    });

    return changed;
  }

  remove(name: string, key: K) : boolean {
    const map = this._getMap(name);
    if (!map) return false;
    return !map.delete(key)
  }


}