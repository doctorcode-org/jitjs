import {
    Complex,
    Polar,
    type CartesianCoordinates,
} from "../core/geometry.js";
import { extend, merge, splat, typeOf } from "../core/util.js";
import type {
    EdgeData,
    NodeData,
    PositionPhase,
} from "../types.js";

/** The minimal position contract used by the graph data model. */
export interface GraphPosition {
    getc(simple: true): CartesianCoordinates;
    set(value: never): void;
}

/** A zero-argument position constructor, matching the legacy `klass` option. */
export type GraphPositionConstructor<TPosition extends GraphPosition> = new () => TPosition;

/** Rendering defaults consulted by node and adjacency data accessors. */
export interface GraphElementConfig extends Record<string, unknown> {
    overridable?: unknown;
    CanvasStyles?: Record<string, unknown>;
}

/** Label defaults consulted by label-data accessors. */
export type GraphLabelConfig = Record<string, unknown>;

/** Per-node defaults copied onto every node created by a graph. */
export type GraphNodeDefaults = Record<string, unknown>;

export interface GraphOptions<TPosition extends GraphPosition = Complex>
    extends Record<string, unknown> {
    klass?: GraphPositionConstructor<TPosition>;
    Node?: GraphNodeDefaults;
}

interface ResolvedGraphOptions<TPosition extends GraphPosition>
    extends Record<string, unknown> {
    klass: GraphPositionConstructor<TPosition>;
    Node: GraphNodeDefaults;
}

export interface GraphNodeInput<TNodeData extends NodeData = NodeData>
    extends Record<string, unknown> {
    id: string;
    name: string;
    data?: TNodeData;
}

type DataPhase = PositionPhase | undefined;
type Dataset = Record<string, unknown | readonly unknown[]>;

abstract class GraphElementAccessors<TData extends Record<string, unknown>> {
    [key: string]: unknown;

    abstract data: TData;
    abstract startData: Record<string, unknown>;
    abstract endData: Record<string, unknown>;
    abstract Config: GraphElementConfig | undefined;
    abstract Label: GraphLabelConfig | undefined;

    private dataForPhase(type: DataPhase): Record<string, unknown> {
        const phase = type || "current";
        let data: Record<string, unknown> | undefined;

        if (phase === "current") {
            data = this.data;
        } else if (phase === "start") {
            data = this.startData;
        } else if (phase === "end") {
            data = this.endData;
        }

        // Invalid phase strings failed later in the legacy implementation too.
        return data as Record<string, unknown>;
    }

    private getDataInternal<TValue>(
        prefix: string,
        property: string,
        type: DataPhase,
        force: boolean | undefined,
        prefixConfig: Record<string, unknown> | undefined,
    ): TValue {
        const data = this.dataForPhase(type);
        const normalizedPrefix = `$${prefix ? `${prefix}-` : ""}`;
        const dataKey = `${normalizedPrefix}${property}`;

        if (force) {
            return data[dataKey] as TValue;
        }

        if (!(this.Config as GraphElementConfig).overridable) {
            return (((prefixConfig as Record<string, unknown>)[property] as TValue) ||
                0) as TValue;
        }

        return (dataKey in data
            ? data[dataKey]
            : dataKey in this.data
                ? this.data[dataKey]
                : (prefixConfig as Record<string, unknown>)[property] || 0) as TValue;
    }

    private setDataInternal(
        prefix: string,
        property: string,
        value: unknown,
        type: DataPhase,
    ): void {
        const data = this.dataForPhase(type);
        const normalizedPrefix = `$${prefix ? `${prefix}-` : ""}`;
        data[`${normalizedPrefix}${property}`] = value;
    }

    private removeDataInternal(prefix: string, properties: readonly string[]): void {
        const normalizedPrefix = `$${prefix ? `${prefix}-` : ""}`;
        for (const property of properties) {
            const dataKey = `${normalizedPrefix}${property}`;
            delete this.data[dataKey];
            delete this.startData[dataKey];
            delete this.endData[dataKey];
        }
    }

    private setValues(
        setter: (property: string, value: unknown, type: DataPhase) => void,
        types: PositionPhase | readonly PositionPhase[],
        values: Dataset,
    ): void {
        const phases = splat(types);
        for (const property in values) {
            const propertyValues = splat(values[property]);
            for (let index = 0; index < phases.length; index += 1) {
                setter(property, propertyValues[index], phases[index]);
            }
        }
    }

    getData<TValue = unknown>(
        property: string,
        type?: PositionPhase,
        force?: boolean,
    ): TValue {
        return this.getDataInternal<TValue>("", property, type, force, this.Config);
    }

    setData(property: string, value: unknown, type?: PositionPhase): void {
        this.setDataInternal("", property, value, type);
    }

    setDataset(
        types: PositionPhase | readonly PositionPhase[],
        values: Dataset,
    ): void {
        this.setValues(this.setData.bind(this), types, values);
    }

    removeData(...properties: string[]): void {
        this.removeDataInternal("", properties);
    }

    getCanvasStyle<TValue = unknown>(
        property: string,
        type?: PositionPhase,
        force?: boolean,
    ): TValue {
        return this.getDataInternal<TValue>(
            "canvas",
            property,
            type,
            force,
            (this.Config as GraphElementConfig).CanvasStyles,
        );
    }

    setCanvasStyle(property: string, value: unknown, type?: PositionPhase): void {
        this.setDataInternal("canvas", property, value, type);
    }

    setCanvasStyles(
        types: PositionPhase | readonly PositionPhase[],
        values: Dataset,
    ): void {
        this.setValues(this.setCanvasStyle.bind(this), types, values);
    }

    removeCanvasStyle(...properties: string[]): void {
        this.removeDataInternal("canvas", properties);
    }

    getLabelData<TValue = unknown>(
        property: string,
        type?: PositionPhase,
        force?: boolean,
    ): TValue {
        return this.getDataInternal<TValue>(
            "label",
            property,
            type,
            force,
            this.Label,
        );
    }

    setLabelData(property: string, value: unknown, type?: PositionPhase): void {
        this.setDataInternal("label", property, value, type);
    }

    setLabelDataset(
        types: PositionPhase | readonly PositionPhase[],
        values: Dataset,
    ): void {
        this.setValues(this.setLabelData.bind(this), types, values);
    }

    removeLabelData(...properties: string[]): void {
        this.removeDataInternal("label", properties);
    }
}

export class GraphNode<
    TNodeData extends NodeData = NodeData,
    TEdgeData extends EdgeData = EdgeData,
    TPosition extends GraphPosition = Complex,
> extends GraphElementAccessors<TNodeData> {
    declare id: string;
    declare name: string;
    declare data: TNodeData;
    declare startData: Record<string, unknown>;
    declare endData: Record<string, unknown>;
    declare adjacencies: Record<
        string,
        GraphAdjacency<TNodeData, TEdgeData, TPosition>
    >;
    declare selected: boolean;
    declare drawn: boolean;
    declare exist: boolean;
    declare angleSpan: { begin: number; end: number };
    declare pos: TPosition;
    declare startPos: TPosition;
    declare endPos: TPosition;
    declare Config: GraphElementConfig | undefined;
    declare Node: GraphElementConfig | undefined;
    declare Edge: GraphElementConfig | undefined;
    declare Label: GraphLabelConfig | undefined;
    declare $$family: string;
    declare _flag: boolean | undefined;
    declare _depth: number | undefined;

    constructor(
        options: Partial<GraphNode<TNodeData, TEdgeData, TPosition>> &
            Record<string, unknown>,
        positionConstructor: GraphPositionConstructor<TPosition>,
        nodeConfig?: GraphElementConfig,
        edgeConfig?: GraphElementConfig,
        labelConfig?: GraphLabelConfig,
    ) {
        super();

        const defaults = {
            id: "",
            name: "",
            data: {} as TNodeData,
            startData: {},
            endData: {},
            adjacencies: {},
            selected: false,
            drawn: false,
            exist: false,
            angleSpan: { begin: 0, end: 0 },
            pos: new positionConstructor(),
            startPos: new positionConstructor(),
            endPos: new positionConstructor(),
        };

        extend(this, extend(defaults, options));
        this.Config = this.Node = nodeConfig;
        this.Edge = edgeConfig;
        this.Label = labelConfig;
        this.$$family = "class";
    }

    adjacentTo(node: Pick<GraphNode, "id">): boolean {
        return node.id in this.adjacencies;
    }

    getAdjacency(
        id: string,
    ): GraphAdjacency<TNodeData, TEdgeData, TPosition> | undefined {
        return this.adjacencies[id];
    }

    getPos(type: PositionPhase = "current"): TPosition | undefined {
        if (type === "current") {
            return this.pos;
        }
        if (type === "end") {
            return this.endPos;
        }
        if (type === "start") {
            return this.startPos;
        }
        return undefined;
    }

    setPos(value: TPosition, type: PositionPhase = "current"): void {
        const position = this.getPos(type);
        (position as TPosition).set(value as never);
    }

    eachAdjacency(
        action: (
            adjacency: GraphAdjacency<TNodeData, TEdgeData, TPosition>,
            id: string,
        ) => void,
        flags?: unknown,
    ): void {
        graphEachAdjacency(this, action, flags);
    }

    eachLevel(
        levelBegin: number,
        levelEnd: number | false,
        action: (node: GraphNode<TNodeData, TEdgeData, TPosition>, depth: number) => void,
        flags?: unknown,
    ): void {
        graphEachLevel(this, levelBegin, levelEnd, action, flags);
    }

    eachSubgraph(
        action: (node: GraphNode<TNodeData, TEdgeData, TPosition>, depth: number) => void,
        flags?: unknown,
    ): void {
        graphEachSubgraph(this, action, flags);
    }

    eachSubnode(
        action: (node: GraphNode<TNodeData, TEdgeData, TPosition>, depth: number) => void,
        flags?: unknown,
    ): void {
        graphEachSubnode(this, action, flags);
    }

    anySubnode(
        condition?:
            | string
            | false
            | null
            | ((node: GraphNode<TNodeData, TEdgeData, TPosition>) => unknown),
        flags?: unknown,
    ): boolean {
        return graphAnySubnode(this, condition, flags);
    }

    getSubnodes(
        level?: number | readonly [number, number],
        flags?: unknown,
    ): Array<GraphNode<TNodeData, TEdgeData, TPosition>> {
        return graphGetSubnodes(this, level, flags);
    }

    getParents(): Array<GraphNode<TNodeData, TEdgeData, TPosition>> {
        return graphGetParents(this);
    }

    isDescendantOf(id: string): boolean {
        return graphIsDescendantOf(this, id);
    }
}

export class GraphAdjacency<
    TNodeData extends NodeData = NodeData,
    TEdgeData extends EdgeData = EdgeData,
    TPosition extends GraphPosition = Complex,
> extends GraphElementAccessors<TEdgeData> {
    declare nodeFrom: GraphNode<TNodeData, TEdgeData, TPosition>;
    declare nodeTo: GraphNode<TNodeData, TEdgeData, TPosition>;
    declare data: TEdgeData;
    declare startData: Record<string, unknown>;
    declare endData: Record<string, unknown>;
    declare Config: GraphElementConfig | undefined;
    declare Edge: GraphElementConfig | undefined;
    declare Label: GraphLabelConfig | undefined;
    declare $$family: string;

    constructor(
        nodeFrom: GraphNode<TNodeData, TEdgeData, TPosition>,
        nodeTo: GraphNode<TNodeData, TEdgeData, TPosition>,
        data?: TEdgeData,
        edgeConfig?: GraphElementConfig,
        labelConfig?: GraphLabelConfig,
    ) {
        super();
        this.nodeFrom = nodeFrom;
        this.nodeTo = nodeTo;
        this.data = (data || {}) as TEdgeData;
        this.startData = {};
        this.endData = {};
        this.Config = this.Edge = edgeConfig;
        this.Label = labelConfig;
        this.$$family = "class";
    }
}

class GraphNodeList<
    TNodeData extends NodeData,
    TEdgeData extends EdgeData,
    TPosition extends GraphPosition,
> {
    constructor(private readonly graph: Graph<TNodeData, TEdgeData, TPosition>) { }

    private apply(
        action: (node: GraphNode<TNodeData, TEdgeData, TPosition>) => void,
    ): void {
        this.graph.eachNode(action);
    }

    getData(property: string, type?: PositionPhase, force?: boolean): void {
        this.apply((node) => void node.getData(property, type, force));
    }

    setData(property: string, value: unknown, type?: PositionPhase): void {
        this.apply((node) => node.setData(property, value, type));
    }

    setDataset(
        types: PositionPhase | readonly PositionPhase[],
        values: Dataset,
    ): void {
        this.apply((node) => node.setDataset(types, values));
    }

    removeData(...properties: string[]): void {
        this.apply((node) => node.removeData(...properties));
    }

    getCanvasStyle(property: string, type?: PositionPhase, force?: boolean): void {
        this.apply((node) => void node.getCanvasStyle(property, type, force));
    }

    setCanvasStyle(property: string, value: unknown, type?: PositionPhase): void {
        this.apply((node) => node.setCanvasStyle(property, value, type));
    }

    setCanvasStyles(
        types: PositionPhase | readonly PositionPhase[],
        values: Dataset,
    ): void {
        this.apply((node) => node.setCanvasStyles(types, values));
    }

    removeCanvasStyle(...properties: string[]): void {
        this.apply((node) => node.removeCanvasStyle(...properties));
    }

    getLabelData(property: string, type?: PositionPhase, force?: boolean): void {
        this.apply((node) => void node.getLabelData(property, type, force));
    }

    setLabelData(property: string, value: unknown, type?: PositionPhase): void {
        this.apply((node) => node.setLabelData(property, value, type));
    }

    setLabelDataset(
        types: PositionPhase | readonly PositionPhase[],
        values: Dataset,
    ): void {
        this.apply((node) => node.setLabelDataset(types, values));
    }

    removeLabelData(...properties: string[]): void {
        this.apply((node) => node.removeLabelData(...properties));
    }
}

export class Graph<
    TNodeData extends NodeData = NodeData,
    TEdgeData extends EdgeData = EdgeData,
    TPosition extends GraphPosition = Complex,
> {
    static get Node(): typeof GraphNode {
        return GraphNode;
    }

    static get Adjacence(): typeof GraphAdjacency {
        return GraphAdjacency;
    }

    static get Util(): typeof GraphUtil {
        return GraphUtil;
    }

    Node: GraphElementConfig | undefined;
    Edge: GraphElementConfig | undefined;
    Label: GraphLabelConfig | undefined;
    opt: ResolvedGraphOptions<TPosition>;
    nodes: Record<string, GraphNode<TNodeData, TEdgeData, TPosition>>;
    edges: Record<
        string,
        Record<string, GraphAdjacency<TNodeData, TEdgeData, TPosition>>
    >;
    nodeList: GraphNodeList<TNodeData, TEdgeData, TPosition>;
    $$family: string;

    constructor(
        options?: GraphOptions<TPosition>,
        nodeConfig?: GraphElementConfig,
        edgeConfig?: GraphElementConfig,
        labelConfig?: GraphLabelConfig,
    ) {
        this.Node = nodeConfig;
        this.Edge = edgeConfig;
        this.Label = labelConfig;
        this.opt = merge(
            {
                klass: Complex as unknown as GraphPositionConstructor<TPosition>,
                Node: {},
            },
            options || {},
        ) as ResolvedGraphOptions<TPosition>;
        this.nodes = {};
        this.edges = {};
        this.nodeList = new GraphNodeList(this);
        this.$$family = "class";
    }

    getNode(id: string): GraphNode<TNodeData, TEdgeData, TPosition> | undefined {
        return graphGetNode(this, id);
    }

    /** A working explicit alias for the legacy API's documented `get` method. */
    get(id: string): GraphNode<TNodeData, TEdgeData, TPosition> | undefined {
        return this.getNode(id);
    }

    getByName(
        name: string,
    ): GraphNode<TNodeData, TEdgeData, TPosition> | false {
        for (const id in this.nodes) {
            const node = this.nodes[id] as GraphNode<TNodeData, TEdgeData, TPosition>;
            // Preserve legacy coercion for callers crossing the untyped JS boundary.
            if (node.name == name) {
                return node;
            }
        }
        return false;
    }

    getAdjacence(
        id: string,
        otherId: string,
    ): GraphAdjacency<TNodeData, TEdgeData, TPosition> | false | undefined {
        if (id in this.edges) {
            return this.edges[id]?.[otherId];
        }
        return false;
    }

    addNode(
        input: GraphNodeInput<TNodeData>,
    ): GraphNode<TNodeData, TEdgeData, TPosition> {
        if (!this.nodes[input.id]) {
            const adjacencies = (this.edges[input.id] = {});
            const options = extend(
                {
                    id: input.id,
                    name: input.name,
                    data: merge(input.data || {}, {}) as TNodeData,
                    adjacencies,
                },
                this.opt.Node,
            );

            this.nodes[input.id] = new GraphNode(
                options,
                this.opt.klass,
                this.Node,
                this.Edge,
                this.Label,
            );
        }
        return this.nodes[input.id] as GraphNode<TNodeData, TEdgeData, TPosition>;
    }

    addAdjacence(
        input: GraphNodeInput<TNodeData>,
        otherInput: GraphNodeInput<TNodeData>,
        data?: TEdgeData,
    ): GraphAdjacency<TNodeData, TEdgeData, TPosition> {
        if (!this.hasNode(input.id)) {
            this.addNode(input);
        }
        if (!this.hasNode(otherInput.id)) {
            this.addNode(otherInput);
        }

        const node = this.nodes[input.id] as GraphNode<
            TNodeData,
            TEdgeData,
            TPosition
        >;
        const otherNode = this.nodes[otherInput.id] as GraphNode<
            TNodeData,
            TEdgeData,
            TPosition
        >;

        if (!node.adjacentTo(otherNode)) {
            const adjacencies = (this.edges[input.id] = this.edges[input.id] || {});
            const otherAdjacencies = (this.edges[otherInput.id] =
                this.edges[otherInput.id] || {});
            const adjacency = new GraphAdjacency(
                node,
                otherNode,
                data,
                this.Edge,
                this.Label,
            );
            otherAdjacencies[input.id] = adjacency;
            adjacencies[otherInput.id] = adjacency;
            return adjacency;
        }

        return this.edges[input.id]?.[otherInput.id] as GraphAdjacency<
            TNodeData,
            TEdgeData,
            TPosition
        >;
    }

    removeNode(id: string): void {
        if (this.hasNode(id)) {
            delete this.nodes[id];
            const adjacencies = this.edges[id] as Record<
                string,
                GraphAdjacency<TNodeData, TEdgeData, TPosition>
            >;
            for (const otherId in adjacencies) {
                delete (this.edges[otherId] as Record<string, unknown>)[id];
            }
            delete this.edges[id];
        }
    }

    removeAdjacence(id: string, otherId: string): void {
        delete (this.edges[id] as Record<string, unknown>)[otherId];
        delete (this.edges[otherId] as Record<string, unknown>)[id];
    }

    hasNode(id: string): boolean {
        return id in this.nodes;
    }

    empty(): void {
        this.nodes = {};
        this.edges = {};
    }

    eachNode(
        action: (node: GraphNode<TNodeData, TEdgeData, TPosition>) => void,
        flags?: unknown,
    ): void {
        graphEachNode(this, action, flags);
    }

    each(
        action: (node: GraphNode<TNodeData, TEdgeData, TPosition>) => void,
        flags?: unknown,
    ): void {
        graphEachNode(this, action, flags);
    }

    computeLevels(id: string, startDepth?: number, flags?: unknown): void {
        graphComputeLevels(this, id, startDepth, flags);
    }

    eachBFS(
        id: string,
        action: (
            node: GraphNode<TNodeData, TEdgeData, TPosition>,
            depth: number | undefined,
        ) => void,
        flags?: unknown,
    ): void {
        graphEachBFS(this, id, action, flags);
    }

    clean(): void {
        graphClean(this);
    }

    getClosestNodeToOrigin(
        property?: PositionPhase,
        flags?: unknown,
    ): GraphNode<TNodeData, TEdgeData, TPosition> | null {
        return graphGetClosestNodeToOrigin(this, property, flags);
    }

    getClosestNodeToPos(
        position?: GraphPosition | null | false,
        property?: PositionPhase,
        flags?: unknown,
    ): GraphNode<TNodeData, TEdgeData, TPosition> | null {
        return graphGetClosestNodeToPos(this, position, property, flags);
    }
}

export function graphFilter<TElement extends Record<string, unknown>>(
    parameter?: unknown,
): (element: TElement) => boolean {
    if (!parameter || typeOf(parameter) !== "string") {
        return () => true;
    }

    const properties = (parameter as string).split(" ");
    return (element) => {
        for (const property of properties) {
            if (element[property]) {
                return false;
            }
        }
        return true;
    };
}

export function graphGetNode<
    TNodeData extends NodeData,
    TEdgeData extends EdgeData,
    TPosition extends GraphPosition,
>(
    graph: Graph<TNodeData, TEdgeData, TPosition>,
    id: string,
): GraphNode<TNodeData, TEdgeData, TPosition> | undefined {
    return graph.nodes[id];
}

export function graphEachNode<
    TNodeData extends NodeData,
    TEdgeData extends EdgeData,
    TPosition extends GraphPosition,
>(
    graph: Graph<TNodeData, TEdgeData, TPosition>,
    action: (node: GraphNode<TNodeData, TEdgeData, TPosition>) => void,
    flags?: unknown,
): void {
    const filter = graphFilter<GraphNode<TNodeData, TEdgeData, TPosition>>(flags);
    for (const id in graph.nodes) {
        const node = graph.nodes[id] as GraphNode<TNodeData, TEdgeData, TPosition>;
        if (filter(node)) {
            action(node);
        }
    }
}

export function graphEachAdjacency<
    TNodeData extends NodeData,
    TEdgeData extends EdgeData,
    TPosition extends GraphPosition,
>(
    node: GraphNode<TNodeData, TEdgeData, TPosition>,
    action: (
        adjacency: GraphAdjacency<TNodeData, TEdgeData, TPosition>,
        id: string,
    ) => void,
    flags?: unknown,
): void {
    const filter = graphFilter<
        GraphAdjacency<TNodeData, TEdgeData, TPosition>
    >(flags);

    for (const id in node.adjacencies) {
        const adjacency = node.adjacencies[id] as GraphAdjacency<
            TNodeData,
            TEdgeData,
            TPosition
        >;
        if (filter(adjacency)) {
            if (adjacency.nodeFrom != node) {
                const previousFrom = adjacency.nodeFrom;
                adjacency.nodeFrom = adjacency.nodeTo;
                adjacency.nodeTo = previousFrom;
            }
            action(adjacency, id);
        }
    }
}

export function graphComputeLevels<
    TNodeData extends NodeData,
    TEdgeData extends EdgeData,
    TPosition extends GraphPosition,
>(
    graph: Graph<TNodeData, TEdgeData, TPosition>,
    id: string,
    initialDepth?: number,
    flags?: unknown,
): void {
    const startDepth = initialDepth || 0;
    const filter = graphFilter<GraphNode<TNodeData, TEdgeData, TPosition>>(flags);

    graphEachNode(
        graph,
        (node) => {
            node._flag = false;
            node._depth = -1;
        },
        flags,
    );

    const root = graph.getNode(id) as GraphNode<TNodeData, TEdgeData, TPosition>;
    root._depth = startDepth;
    const queue = [root];

    while (queue.length !== 0) {
        const node = queue.pop() as GraphNode<TNodeData, TEdgeData, TPosition>;
        node._flag = true;
        graphEachAdjacency(
            node,
            (adjacency) => {
                const adjacentNode = adjacency.nodeTo;
                if (adjacentNode._flag == false && filter(adjacentNode)) {
                    if ((adjacentNode._depth as number) < 0) {
                        adjacentNode._depth =
                            (node._depth as number) + 1 + startDepth;
                    }
                    queue.unshift(adjacentNode);
                }
            },
            flags,
        );
    }
}

export function graphEachBFS<
    TNodeData extends NodeData,
    TEdgeData extends EdgeData,
    TPosition extends GraphPosition,
>(
    graph: Graph<TNodeData, TEdgeData, TPosition>,
    id: string,
    action: (
        node: GraphNode<TNodeData, TEdgeData, TPosition>,
        depth: number | undefined,
    ) => void,
    flags?: unknown,
): void {
    const filter = graphFilter<GraphNode<TNodeData, TEdgeData, TPosition>>(flags);
    graphClean(graph);
    const queue = [
        graph.getNode(id) as GraphNode<TNodeData, TEdgeData, TPosition>,
    ];

    while (queue.length !== 0) {
        const node = queue.pop() as GraphNode<TNodeData, TEdgeData, TPosition>;
        node._flag = true;
        action(node, node._depth);
        graphEachAdjacency(
            node,
            (adjacency) => {
                const adjacentNode = adjacency.nodeTo;
                if (adjacentNode._flag == false && filter(adjacentNode)) {
                    adjacentNode._flag = true;
                    queue.unshift(adjacentNode);
                }
            },
            flags,
        );
    }
}

export function graphEachLevel<
    TNodeData extends NodeData,
    TEdgeData extends EdgeData,
    TPosition extends GraphPosition,
>(
    node: GraphNode<TNodeData, TEdgeData, TPosition>,
    levelBegin: number,
    requestedLevelEnd: number | false,
    action: (node: GraphNode<TNodeData, TEdgeData, TPosition>, depth: number) => void,
    flags?: unknown,
): void {
    const initialDepth = node._depth as number;
    const filter = graphFilter<GraphNode<TNodeData, TEdgeData, TPosition>>(flags);
    const levelEnd =
        requestedLevelEnd === false
            ? Number.MAX_VALUE - initialDepth
            : requestedLevelEnd;

    const visit = (
        current: GraphNode<TNodeData, TEdgeData, TPosition>,
        begin: number,
        end: number,
    ): void => {
        const depth = current._depth as number;
        if (depth >= begin && depth <= end && filter(current)) {
            action(current, depth);
        }
        if (depth < end) {
            graphEachAdjacency(current, (adjacency) => {
                const adjacentNode = adjacency.nodeTo;
                if ((adjacentNode._depth as number) > depth) {
                    visit(adjacentNode, begin, end);
                }
            });
        }
    };

    visit(node, levelBegin + initialDepth, levelEnd + initialDepth);
}

export function graphEachSubgraph<
    TNodeData extends NodeData,
    TEdgeData extends EdgeData,
    TPosition extends GraphPosition,
>(
    node: GraphNode<TNodeData, TEdgeData, TPosition>,
    action: (node: GraphNode<TNodeData, TEdgeData, TPosition>, depth: number) => void,
    flags?: unknown,
): void {
    graphEachLevel(node, 0, false, action, flags);
}

export function graphEachSubnode<
    TNodeData extends NodeData,
    TEdgeData extends EdgeData,
    TPosition extends GraphPosition,
>(
    node: GraphNode<TNodeData, TEdgeData, TPosition>,
    action: (node: GraphNode<TNodeData, TEdgeData, TPosition>, depth: number) => void,
    flags?: unknown,
): void {
    graphEachLevel(node, 1, 1, action, flags);
}

export function graphAnySubnode<
    TNodeData extends NodeData,
    TEdgeData extends EdgeData,
    TPosition extends GraphPosition,
>(
    node: GraphNode<TNodeData, TEdgeData, TPosition>,
    condition?:
        | string
        | false
        | null
        | ((node: GraphNode<TNodeData, TEdgeData, TPosition>) => unknown),
    flags?: unknown,
): boolean {
    let found = false;
    const normalizedCondition = condition || (() => true);
    const predicate =
        typeOf(normalizedCondition) === "string"
            ? (candidate: GraphNode<TNodeData, TEdgeData, TPosition>): unknown =>
                candidate[normalizedCondition as string]
            : (normalizedCondition as (
                candidate: GraphNode<TNodeData, TEdgeData, TPosition>,
            ) => unknown);

    graphEachSubnode(
        node,
        (candidate) => {
            if (predicate(candidate)) {
                found = true;
            }
        },
        flags,
    );
    return found;
}

export function graphGetSubnodes<
    TNodeData extends NodeData,
    TEdgeData extends EdgeData,
    TPosition extends GraphPosition,
>(
    node: GraphNode<TNodeData, TEdgeData, TPosition>,
    requestedLevel?: number | readonly [number, number],
    flags?: unknown,
): Array<GraphNode<TNodeData, TEdgeData, TPosition>> {
    const result: Array<GraphNode<TNodeData, TEdgeData, TPosition>> = [];
    const level = requestedLevel || 0;
    let levelStart: number;
    let levelEnd: number;

    if (typeOf(level) === "array") {
        const range = level as readonly [number, number];
        levelStart = range[0];
        levelEnd = range[1];
    } else {
        levelStart = level as number;
        levelEnd = Number.MAX_VALUE - (node._depth as number);
    }

    graphEachLevel(
        node,
        levelStart,
        levelEnd,
        (candidate) => result.push(candidate),
        flags,
    );
    return result;
}

export function graphGetParents<
    TNodeData extends NodeData,
    TEdgeData extends EdgeData,
    TPosition extends GraphPosition,
>(
    node: GraphNode<TNodeData, TEdgeData, TPosition>,
): Array<GraphNode<TNodeData, TEdgeData, TPosition>> {
    const result: Array<GraphNode<TNodeData, TEdgeData, TPosition>> = [];
    graphEachAdjacency(node, (adjacency) => {
        const parent = adjacency.nodeTo;
        if ((parent._depth as number) < (node._depth as number)) {
            result.push(parent);
        }
    });
    return result;
}

export function graphIsDescendantOf<
    TNodeData extends NodeData,
    TEdgeData extends EdgeData,
    TPosition extends GraphPosition,
>(
    node: GraphNode<TNodeData, TEdgeData, TPosition>,
    id: string,
): boolean {
    if (node.id == id) {
        return true;
    }

    const parents = graphGetParents(node);
    let result = false;
    for (let index = 0; !result && index < parents.length; index += 1) {
        result = result || graphIsDescendantOf(parents[index] as typeof node, id);
    }
    return result;
}

export function graphClean<
    TNodeData extends NodeData,
    TEdgeData extends EdgeData,
    TPosition extends GraphPosition,
>(graph: Graph<TNodeData, TEdgeData, TPosition>): void {
    graphEachNode(graph, (node) => {
        node._flag = false;
    });
}

export function graphGetClosestNodeToOrigin<
    TNodeData extends NodeData,
    TEdgeData extends EdgeData,
    TPosition extends GraphPosition,
>(
    graph: Graph<TNodeData, TEdgeData, TPosition>,
    property?: PositionPhase,
    flags?: unknown,
): GraphNode<TNodeData, TEdgeData, TPosition> | null {
    return graphGetClosestNodeToPos(graph, Polar.KER, property, flags);
}

export function graphGetClosestNodeToPos<
    TNodeData extends NodeData,
    TEdgeData extends EdgeData,
    TPosition extends GraphPosition,
>(
    graph: Graph<TNodeData, TEdgeData, TPosition>,
    requestedPosition?: GraphPosition | null | false,
    requestedProperty?: PositionPhase,
    flags?: unknown,
): GraphNode<TNodeData, TEdgeData, TPosition> | null {
    let closest: GraphNode<TNodeData, TEdgeData, TPosition> | null = null;
    const property = requestedProperty || "current";
    const position =
        (requestedPosition && requestedPosition.getc(true)) || Complex.KER;
    const distance = (
        left: CartesianCoordinates,
        right: CartesianCoordinates,
    ): number => {
        const x = left.x - right.x;
        const y = left.y - right.y;
        return x * x + y * y;
    };

    graphEachNode(
        graph,
        (node) => {
            const nodePosition = (node.getPos(property) as TPosition).getc(true);
            if (
                closest === null ||
                distance(nodePosition, position) <
                distance(
                    (closest.getPos(property) as TPosition).getc(true),
                    position,
                )
            ) {
                closest = node;
            }
        },
        flags,
    );

    return closest;
}

/** Static utility surface retained without runtime prototype injection. */
export const GraphUtil = {
    filter: graphFilter,
    getNode: graphGetNode,
    eachNode: graphEachNode,
    each: graphEachNode,
    eachAdjacency: graphEachAdjacency,
    computeLevels: graphComputeLevels,
    eachBFS: graphEachBFS,
    eachLevel: graphEachLevel,
    eachSubgraph: graphEachSubgraph,
    eachSubnode: graphEachSubnode,
    anySubnode: graphAnySubnode,
    getSubnodes: graphGetSubnodes,
    getParents: graphGetParents,
    isDescendantOf: graphIsDescendantOf,
    clean: graphClean,
    getClosestNodeToOrigin: graphGetClosestNodeToOrigin,
    getClosestNodeToPos: graphGetClosestNodeToPos,
} as const;
