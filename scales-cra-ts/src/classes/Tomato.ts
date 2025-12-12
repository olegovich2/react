import { Product } from './Product';

export class Tomato extends Product {
  private isRipe: boolean; // созрел ли
  private type: string; // тип (черри, биф и т.д.)

  constructor(name: string, scale: number, isRipe: boolean = true, type: string = "обычный") {
    super(name, scale);
    this.isRipe = isRipe;
    this.type = type;
  }

  getScale(): number {
    return this.scale;
  }

  getName(): string {
    const ripeness = this.isRipe ? "созревший" : "недозревший";
    return `Помидор "${this.name}" (${this.type}, ${ripeness})`;
  }

}