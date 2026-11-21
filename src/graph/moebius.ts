export interface MoebiusVector<TVector> {
  scale(factor: number): TVector;
}

export interface MoebiusCartesian<TVector> {
  moebiusTransformation(vector: TVector): unknown;
}

export interface MoebiusPosition<TVector> {
  getc(): MoebiusCartesian<TVector>;
  set(value: never): void;
}

export interface MoebiusNode<
  TVector,
  TPhase extends string = string,
  TPosition extends MoebiusPosition<TVector> = MoebiusPosition<TVector>,
> {
  getPos(phase?: TPhase): TPosition | undefined;
}

export interface MoebiusGraph<TNode> {
  eachNode(visit: (node: TNode) => void, flags?: unknown): void;
}

/**
 * Explicit counterpart of Graph.Util.moebiusTransformation. It retains the
 * legacy phase and vector ordering without patching Graph.Util or Complex.
 */
export function transformGraphMoebius<
  TVector extends MoebiusVector<TVector>,
  TPhase extends string,
  TPosition extends MoebiusPosition<TVector>,
  TNode extends MoebiusNode<TVector, TPhase, TPosition>,
>(
  graph: MoebiusGraph<TNode>,
  positions: readonly TVector[],
  phases: readonly TPhase[],
  startPhase?: TPhase,
  flags?: unknown,
): void {
  graph.eachNode((node) => {
    for (let index = 0; index < phases.length; index += 1) {
      const vector = (positions[index] as TVector).scale(-1);
      const targetPhase = phases[index] as TPhase;
      const sourcePhase = startPhase || targetPhase;
      const transformed = (node
        .getPos(sourcePhase) as TPosition)
        .getc()
        .moebiusTransformation(vector);
      (node.getPos(targetPhase) as TPosition).set(transformed as never);
    }
  }, flags);
}
