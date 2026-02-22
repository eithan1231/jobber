export type ContainerStart = {
  image: string;
};

export type ContainerInfoBasic = {
  id: string;
  image: string;
  status: string;
};

export type ContainerInfo = ContainerInfoBasic & {};

export abstract class Container {
  public abstract getContainers(): unknown;

  public abstract startContainer(): Promise<void>;

  public abstract stopContainer(): Promise<void>;

  public abstract removeContainer(): Promise<void>;

  public abstract pauseContainer(id: string): Promise<string>;

  public abstract unpauseContainer(id: string): Promise<string>;
}
