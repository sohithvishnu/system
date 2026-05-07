//
//  Profile.swift
//  System-app
//
//  Created by Advanced Intelligence Research on 06.05.2026.
//

import SwiftUI

struct Profile_Stats: Codable {
    let success: Bool
    let stats: UserStats
}

struct UserStats: Codable {
    let totalTasks: Int
    let completedTasks: Int
    let activeTasks: Int
}

struct Profile: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var userStats: UserStats?
    @State private var errorMessage: String?
    @State private var isLoading: Bool = false
    @State private var showingPasswordAlert = false
    @State private var newPasswordInput = ""
    
    func getStats() async {
        let userId = authManager.userId
        guard !userId.isEmpty else {
                print("Error: No User ID found in AuthManager")
                return
            }
        
        isLoading = true
        let urlString = "\(APIConfig.baseURL)/user/stats?user_id=\(userId)"
        guard let url = URL(string: urlString) else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else {
                self.errorMessage = "Failed to login or sever error."
                return
            }
            
            let decodedResponse = try JSONDecoder().decode(Profile_Stats.self, from: data)
            self.userStats = decodedResponse.stats
            self.isLoading = false
        } catch {
            print("Error fetching stats: \(error)")
                        self.errorMessage = "Server error or bad JSON."
                        self.isLoading = false
                    }
        }
    
    
    
    var body: some View {
        let username = authManager.currentuser
        let userId = authManager.userId
        
        AppShellView {
            VStack(alignment: .leading, spacing: 30) {
                
                VStack(alignment: .leading, spacing: 5) {
                    Text("profile")
                        .font(AppTheme.font(size: 24, weight: .bold))
                        .foregroundStyle(AppTheme.textPrimary)
                    Text("\(username)")
                        .font(AppTheme.font(size: 14))
                        .foregroundStyle(AppTheme.textSecondary)
                    
                }
                
                Divider().background(AppTheme.textSecondary.opacity(0.3))
                
                
                HStack(spacing: 20){
                    RoundedRectangle(cornerRadius: 12)
                        .fill(AppTheme.cardBackground)
                        .frame(width: 60, height: 60)
                        .overlay(
                            Text(String(username.prefix(1)).uppercased())
                                .font(AppTheme.font(size: 24, weight: .bold))
                                .foregroundStyle(AppTheme.textPrimary)
                        )
                    VStack(alignment: .leading, spacing: 5) {
                        Text(username)
                            .font(AppTheme.font(size: 18, weight: .bold))
                            .foregroundStyle(AppTheme.textPrimary)
                        Text(userId)
                            .font(AppTheme.font(size: 12))
                            .foregroundStyle(AppTheme.textSecondary)
                    }
                }
                .padding(.top, 10)
                
                HStack(spacing: 15) {
                    StatBox(value: "\(userStats?.totalTasks ?? 0)", label: "total")
                    StatBox(value: "\(userStats?.completedTasks ?? 0)", label: "done")
                    StatBox(value: "\(userStats?.activeTasks ?? 0)", label: "active")
                }
                
                VStack(alignment: .leading, spacing: 10) {
                    Text("Account")
                        .font(AppTheme.font(size: 12))
                        .foregroundStyle(AppTheme.textSecondary)
                        .padding(.top, 20)
                    
                    ActionRow(icon: "lock", title: "Change Password", color: AppTheme.textSecondary) {
                        showingPasswordAlert = true
                    }.alert("Change Password", isPresented: $showingPasswordAlert) {
                        SecureField("New Password",text: $newPasswordInput)
                        Button("Change"){
                            Task {
                                let success = await authManager.change_password(to: newPasswordInput)
                                if success{
                                    print("Password updated")
                                    } else {
                                    print("Failed to update password")
                                    }
                                newPasswordInput = ""
                                    
                            }
                            
                        }
                        Button("Cancel", role: .cancel) { newPasswordInput = "" }
                    }
                    
                        
                    
                    
                    ActionRow(icon: "rectangle.portrait.and.arrow.right", title: "Log out",color: AppTheme.accentRed){
                        authManager.logout()
                    }
                }
                
                Spacer()
            }
            .frame(maxWidth: 800, alignment: .leading)
        }.task {
            if userStats == nil {
                await getStats()
            }}
    }
}


struct StatBox: View {
    let value: String
    let label: String
    
    var body: some View {
        VStack(spacing: 8) {
            Text(value)
                .font(AppTheme.font(size: 24, weight: .bold))
                .foregroundStyle(AppTheme.accentGreen)
            
            Text(label)
                .font(AppTheme.font(size: 12))
                .foregroundStyle(AppTheme.textSecondary)
            
        }
        .frame(maxWidth: .infinity)
        .frame(height : 80)
        .background(AppTheme.cardBackground)
        .cornerRadius(10)
        
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.white.opacity(0.05), lineWidth: 1)
        )
    }
}

struct ActionRow: View {
    let icon: String
    let title: String
    let color: Color
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack {
                Image(systemName: icon)
                    .frame(width: 30)
                Text(title)
                    .font(AppTheme.font(size: 14))
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12))
            }
            .foregroundStyle(color)
            .padding()
            .background(AppTheme.cardBackground)
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color.white.opacity(0.05), lineWidth: 1)
            )
        }
        .buttonStyle(PlainButtonStyle()) // Prevents default button flashing
    }
}
