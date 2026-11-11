/**
 * MFC CObject: The principal base class for the Microsoft Foundation Class Library.
 */
export class CObject {
  public static getClassName(): string {
    return "CObject";
  }

  public getRuntimeClass(): string {
    return (this.constructor as any).getClassName?.() || this.constructor.name;
  }

  public isKindOf(className: string): boolean {
    let proto = Object.getPrototypeOf(this);
    while (proto && proto.constructor) {
      if (
        (proto.constructor as any).getClassName?.() === className ||
        proto.constructor.name === className
      ) {
        return true;
      }
      proto = Object.getPrototypeOf(proto);
    }
    return false;
  }

  public assertValid(): void {
    // Basic validity check
  }

  public dump(): string {
    return `[${this.getRuntimeClass()}]`;
  }
}
