//
//  AuthManager.swift
//  System-app
//
//  Created by Advanced Intelligence Research on 06.05.2026.
//

import Foundation
import SwiftUI
import Combine

@MainActor
class AuthManager: ObservableObject {
  
    @Published var isAuthenticatied : Bool = false
    @Published var errorMessage: String? = nil
    
    @Published var currentuser: String = ""
    @Published var userId: String = ""
   
    func checkSavedSession() {
        if let token = KeychainHelper.shared.getToken() {
            self.isAuthenticatied = true
            self.userId = token
            
        }
    }
    init() {
            checkSavedSession()
        
    }
    
    func login(username: String, password: String) async  {
        guard let url = URL(string: "\(APIConfig.baseURL)/auth/login") else {
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: String] = ["username": username, "password": password]
        
        do {
            request.httpBody = try JSONEncoder().encode(body)
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else {
                self.errorMessage = "Failed to login or sever error."
                return
            }
            
            let authResponse = try JSONDecoder().decode(AuthResponse.self, from: data)
            
            KeychainHelper.shared.saveToken(authResponse.userId)
            currentuser = authResponse.username
            userId = authResponse.userId
            
            self.isAuthenticatied = true
            self.errorMessage = nil
        } catch {
            self.errorMessage = "Failed to login or sever error."
        }
    }
    
    func change_password(to newPassword:String) async -> Bool{
        let urlString = "\(APIConfig.baseURL)/user/change_password"
        guard let url = URL(string: urlString) else {return false}
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = ChangePasswordRequest(userId: self.userId, new_password: newPassword)
        do {
            request.httpBody = try JSONEncoder().encode(body)
            let (_, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {return false}
                  return true
        } catch {
            print("Password change failed: \(error)")
            return false
        }
        
        
    }
    
    func logout () {
        KeychainHelper.shared.deleteToken()
        self.isAuthenticatied = false
    }
    
    
}
