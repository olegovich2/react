// Абстрактный класс Product
export abstract class Product {
  protected name: string;
  protected scale: number;

  constructor(name: string, scale: number) {
    this.name = name;
    this.scale = scale;
  }

  // Абстрактные методы (должны быть реализованы в наследниках)
  abstract getScale(): number;
  abstract getName(): string;
}

