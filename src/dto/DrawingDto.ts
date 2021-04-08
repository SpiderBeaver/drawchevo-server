import Drawing, { Dot, isDot, isLine, Line, Point, Shape, ShapeType } from '../domain/Drawing';

interface PointDto {
  x: number;
  y: number;
}

interface ShapeDto {
  type: ShapeType;
}

export interface DotDto extends ShapeDto {
  type: 'Dot';
  point: PointDto;
}

export function isDotDto(shape: ShapeDto): shape is DotDto {
  return shape.type === 'Dot';
}

export interface LineDto {
  type: 'Line';
  start: PointDto;
  end: PointDto;
}

export function isLineDto(shape: ShapeDto): shape is LineDto {
  return shape.type === 'Line';
}

export default interface DrawingDto {
  shapes: ShapeDto[];
}

function pointToDto(point: Point): PointDto {
  return { x: point.x, y: point.y };
}

function pointFromDto(pointDto: PointDto): Point {
  return { x: pointDto.x, y: pointDto.y };
}

function dotToDto(dot: Dot): DotDto {
  return { type: dot.type, point: pointToDto(dot.point) };
}

function dotFromDto(dotDto: DotDto): Dot {
  return { type: dotDto.type, point: pointFromDto(dotDto.point) };
}

function lineToDto(line: Line): LineDto {
  return { type: line.type, start: pointToDto(line.start), end: pointToDto(line.end) };
}

function lineFromDto(lineDto: LineDto): Line {
  return { type: lineDto.type, start: pointFromDto(lineDto.start), end: pointFromDto(lineDto.end) };
}

function shapeToDto(shape: Shape): ShapeDto {
  if (isDot(shape)) {
    return dotToDto(shape);
  } else if (isLine(shape)) {
    return lineToDto(shape);
  } else {
    throw new Error('Shape type not supported');
  }
}

function shapeFromDto(shapeDto: ShapeDto): Shape {
  if (isDotDto(shapeDto)) {
    return dotFromDto(shapeDto);
  } else if (isLineDto(shapeDto)) {
    return lineFromDto(shapeDto);
  } else {
    throw new Error('Shape type not supported');
  }
}

export function drawingToDto(drawing: Drawing): DrawingDto {
  return {
    shapes: drawing.shapes.map((shape) => shapeToDto(shape)),
  };
}

export function drawingFromDto(drawingDto: DrawingDto): Drawing {
  return {
    shapes: drawingDto.shapes.map((shapeDto) => shapeFromDto(shapeDto)),
  };
}
