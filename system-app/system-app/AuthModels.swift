//
//  AuthModels.swift
//  System-app
//
//  Created by Advanced Intelligence Research on 06.05.2026.
//

import Foundation

struct LoginRequest: Codable {
    let username: String
    let password: String
}

struct AuthResponse: Codable {
    let success: Bool
    let userId: String
    let username: String
    
    enum CodingKeys: String, CodingKey {
        case success
        case userId = "user_id"
        case username
    }
}

struct ChangePasswordRequest: Codable {
    let userId: String
    let new_password: String
}
