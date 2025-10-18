
export interface User { 
  id: string,
  displayName: string,
  email: string,
}


export class UserFactory {
    static fromJson(json: any): User {
        return {
            id: json.id,
            displayName: json.displayName,
            email: json.email,
        };
    }
}