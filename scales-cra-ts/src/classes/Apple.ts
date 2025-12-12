import { Product } from './Product';

export class Apple extends Product {
  private color: string;
  private variety: string; // сорт

  constructor(name: string, scale: number, color: string, variety: string) {
    super(name, scale);
    this.color = color;
    this.variety = variety;
  }

  getScale(): number {
    return this.scale;
  }

  getName(): string {
    return `Яблоко "${this.name}" (${this.variety}, ${this.color})`;
  }
  
}