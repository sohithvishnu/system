//
//  LoginView.swift
//  System-app
//
//  Created by Advanced Intelligence Research on 06.05.2026.
//

import SwiftUI

enum LoginViewFoucs {
    case username
    case password
}

struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager
    
    @State private var username = ""
    @State private var password = ""
    @State private var showPassword = false
    @State private var isLoggedIn = false
    
    @FocusState private var focusedField: LoginViewFoucs?
    
    // MARK: - Branding
    var brandingView: some View {
        VStack(alignment: .leading, spacing: 15) {
            RoundedRectangle(cornerRadius: 4)
                .fill(AppTheme.neonGreen)
                .frame(width: 45, height: 45)
                .overlay(
                    Text(">_")
                        .font(.system(size: 20, weight: .black, design: .monospaced))
                        .foregroundStyle(.black)
                )
            
            Text("System")
                .font(.system(size: 50, weight: .black, design: .default))
                .foregroundStyle(.white)
                .tracking(2)
            
            Text("Access Control")
                .font(.system(size: 14, weight: .bold, design: .default))
                .foregroundStyle(AppTheme.neonGreen)
                .tracking(2)
        }
    }
    
    // MARK: - Form
    var formView: some View {
        VStack(alignment: .leading, spacing: 25) {
            
            // Username
            VStack(alignment: .leading, spacing: 10) {
                Text("Username")
                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                    .foregroundStyle(AppTheme.neonGreen)
                
                TextField("", text: $username)
                    .textFieldStyle(.plain)
                    .focused($focusedField, equals: .username)
                    .placeholder(when: username.isEmpty) {
                        Text("Enter Username...").foregroundStyle(.gray).bold()
                    }
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(!username.isEmpty ? AppTheme.neonGreen.opacity(0.15) : Color.white.opacity(0.05))
                            .background(.ultraThinMaterial)
                    )
                    .foregroundStyle(.white)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(!username.isEmpty ? AppTheme.neonGreen : Color.white.opacity(0.1),
                                    lineWidth: !username.isEmpty ? 2 : 1)
                            .shadow(color: !username.isEmpty ? AppTheme.neonGreen.opacity(0.3) : .clear, radius: 4)
                    )
                    .disableAutocorrection(true)
                    .animation(.easeInOut(duration: 0.25), value: username.isEmpty)
            }
            
            // Password
            VStack(alignment: .leading, spacing: 10) {
                Text("Password")
                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                    .foregroundStyle(AppTheme.neonGreen)
                
                HStack {
                    if showPassword {
                        TextField("", text: $password)
                            .textFieldStyle(.plain)
                            .focused($focusedField, equals: .password)
                            .foregroundStyle(.white)
                            .placeholder(when: password.isEmpty) {
                                Text("Enter Password...").foregroundStyle(.gray).bold()
                            }
                    } else {
                        SecureField("", text: $password)
                            .textFieldStyle(.plain)
                            .focused($focusedField, equals: .password)
                            .foregroundStyle(.white)
                            .placeholder(when: password.isEmpty) {
                                Text("Enter Password...").foregroundStyle(.gray).bold()
                            }
                    }
                    
                    Button(action: { showPassword.toggle() }) {
                        Image(systemName: showPassword ? "eye.slash.fill" : "eye.fill")
                            .foregroundStyle(AppTheme.neonGreen)
                    }
                    .buttonStyle(.plain)
                }
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(!password.isEmpty ? AppTheme.neonGreen.opacity(0.15) : Color.white.opacity(0.05))
                        .background(.ultraThinMaterial)
                )
                .foregroundStyle(.white)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(!password.isEmpty ? AppTheme.neonGreen : Color.white.opacity(0.1),
                                lineWidth: !password.isEmpty ? 2 : 1)
                        .shadow(color: !password.isEmpty ? AppTheme.neonGreen.opacity(0.3) : .clear, radius: 4)
                )
                .disableAutocorrection(true)
                .animation(.easeInOut(duration: 0.25), value: password.isEmpty)
            }
            
            // Error
            if let errorMessage = authManager.errorMessage {
                Text(errorMessage)
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .foregroundStyle(.red)
            }
            
            // Login Button
            Button(action: {
                isLoggedIn = true
                Task {
                    await authManager.login(username: username, password: password)
                    isLoggedIn = false
                }
            }) {
                HStack {
                    if isLoggedIn {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .black))
                    } else {
                        Text("Start Session →")
                    }
                }
                .font(.system(size: 16, weight: .bold, design: .monospaced))
                .foregroundStyle(.black)
                .frame(maxWidth: .infinity)
                .padding()
                .background(AppTheme.neonGreen)
                .cornerRadius(8)
            }
            .buttonStyle(.plain)
            .padding(.top, 10)
            .disabled(isLoggedIn || username.isEmpty || password.isEmpty)
            .opacity((isLoggedIn || username.isEmpty || password.isEmpty) ? 0.6 : 1.0)
            
            // Sign Up
            Button(action: {
                print("Navigate to Sign Up")
            }) {
                Text("New Here? Create Account")
                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                    .foregroundStyle(AppTheme.neonGreen)
            }
            .buttonStyle(.plain)
            .padding(.top, 20)
        }
        .frame(maxWidth: 420)
    }
    
    // MARK: - Body
    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            
            Circle()
                .fill(AppTheme.neonGreen.opacity(0.1))
                .blur(radius: 120)
                .frame(width: 400, height: 400)
                .offset(x: 200, y: 200)
            
            GeometryReader { geo in
                if geo.size.width > 700 {
                    // ← Wide (Mac / fullscreen): side by side
                    HStack(alignment: .center, spacing: 60) {
                        brandingView
                            .frame(maxWidth: .infinity, alignment: .leading)
                        
                        Rectangle()
                            .fill(AppTheme.neonGreen.opacity(0.15))
                            .frame(width: 1)
                            .padding(.vertical, 40)
                        
                        formView
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(60)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                    
                } else {
                    // ← Narrow (iPhone): original stacked layout
                    VStack(alignment: .leading) {
                        brandingView
                            .padding(.top, 40)
                        
                        Spacer()
                        
                        formView
                            .padding(.bottom, 50)
                    }
                    .padding(.horizontal, 40)
                    .frame(maxWidth: 800, alignment: .leading)
                }
            }
        }
        .onTapGesture {
            focusedField = nil
        }
    }
}

extension View {
    func placeholder<Content: View>(
        when shouldShow: Bool,
        alignment: Alignment = .leading,
        @ViewBuilder placeholder: () -> Content) -> some View {
            ZStack(alignment: alignment) {
                placeholder().opacity(shouldShow ? 1 : 0)
                self
            }
        }
}
