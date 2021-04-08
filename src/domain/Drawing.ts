export type ShapeType = 'Dot' | 'Line';

export interface Point {
  x: number;
  y: number;
}

export interface Shape {
  type: ShapeType;
}

export interface Dot extends Shape {
  type: 'Dot';
  point: Point;
}

export function isDot(shape: Shape): shape is Dot {
  return shape.type === 'Dot';
}

export interface Line {
  type: 'Line';
  start: Point;
  end: Point;
}

export function isLine(shape: Shape): shape is Line {
  return shape.type === 'Line';
}

export default interface Drawing {
  shapes: Shape[];
}
